import {
  type Backup,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupCategoryRef,
  type BackupCounts,
  type BackupDocumentRow,
  type BackupExpenseRow,
  type BackupIssue,
  type BackupRestoreReport,
  type BackupSection,
  type BackupVehicle,
  type BackupVehicleOutcome,
  CostClass,
  createDocumentSchema,
  type CreateDocumentValues,
  createExpenseCategorySchema,
  createExpenseSchema,
  type CreateExpenseValues,
  createFuelEntrySchema,
  type CreateFuelEntryValues,
  createRefundSchema,
  type CreateRefundValues,
  createServiceRecordSchema,
  type CreateServiceRecordValues,
  createVehicleSchema,
  type CreateVehicleValues,
  ExpenseKind,
  ExpenseSource,
  type RestoreBackupValues,
} from "@automate/shared";
import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "@/database/prisma.service";
import type {
  ExpenseCategory as CategoryRow,
  Vehicle as VehicleRow,
} from "@/generated/prisma/client";
import { DOCUMENT_WITH, toDocumentInput } from "@/modules/documents/documents.mapper";
import { DocumentsService } from "@/modules/documents/documents.service";
import { ExpenseCategoriesService } from "@/modules/expenses/expense-categories.service";
import { toExpenseInput } from "@/modules/expenses/expenses.mapper";
import { ExpensesService } from "@/modules/expenses/expenses.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { RECORD_INCLUDE, toServiceRecordInput } from "@/modules/maintenance/service-record.mapper";
import { ServiceRecordsService } from "@/modules/maintenance/service-records.service";
import { type TripBackupRow, TripBackupService } from "@/modules/trips/trip-backup.service";
import { toVehicle } from "@/modules/vehicles/vehicles.mapper";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

/** Manual entries: linked ones (Fuel, Maintenance, Trips) come back with their own records. */
const BACKED_UP_SOURCES = [ExpenseSource.MANUAL, ExpenseSource.RECURRING, ExpenseSource.IMPORT];
/** Stands in for ids resolved only on restore, so the row can be checked by the create schema. */
const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";
const ISSUES_SHOWN = 50;

const categoryRefSchema = z.object({
  key: z.string().nullable(),
  name: z.string().trim().min(1),
  icon: z.string(),
  costClass: z.enum(CostClass).nullable(),
});

type Planned<T> = { index: number; values: T };
type PlannedExpense = Planned<CreateExpenseValues> & {
  category: BackupCategoryRef;
  subcategory: BackupCategoryRef | null;
  refunds: CreateRefundValues[];
};
interface VehiclePlan {
  outcome: BackupVehicleOutcome;
  issues: BackupIssue[];
  vehicle: CreateVehicleValues | null;
  archived: boolean;
  fuel: (Planned<CreateFuelEntryValues> & { backupId: string | null })[];
  services: Planned<CreateServiceRecordValues>[];
  expenses: PlannedExpense[];
  trips: { index: number; row: TripBackupRow }[];
  documents: Planned<CreateDocumentValues>[];
}

const emptyCounts = (): BackupCounts => ({
  fuel: 0,
  services: 0,
  expenses: 0,
  trips: 0,
  documents: 0,
});
const vehicleName = (values: { make?: unknown; model?: unknown; variant?: unknown }) =>
  [values.make, values.model, values.variant]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ") || "A vehicle";
const firstMessage = (error: z.ZodError) => error.issues[0]?.message ?? "This row can't be read";

/** A trip row in the Trips module's backup shape, as far as handing it over safely needs. */
function isTripRow(row: Record<string, unknown>): row is Record<string, unknown> & TripBackupRow {
  const category = row.category as { name?: unknown } | null;
  return (
    typeof row.version === "number" &&
    typeof category?.name === "string" &&
    Array.isArray(row.stops) &&
    Array.isArray(row.costs) &&
    Array.isArray(row.fuelEntryIds)
  );
}

/** The user-facing reason a module refused a row (4xx), or null for anything unexpected. */
function refusal(error: unknown): string | null {
  if (!(error instanceof HttpException) || error.getStatus() >= 500) return null;
  const body = error.getResponse();
  if (typeof body === "string") return body;
  const { details, message } = body as { details?: { message?: string }[]; message?: unknown };
  return details?.[0]?.message ?? (typeof message === "string" ? message : error.message);
}

/**
 * Backup & Export (M12). A backup holds each vehicle with its fill-ups, service records, manual
 * expenses (with their refunds), trips and document details. Restoring creates every vehicle
 * whose registration isn't in the garage yet, then its rows through their modules' own create
 * services, so the same checks run and linked expenses come back exactly once. A row a module
 * refuses is skipped with its reason; anything unexpected undoes that vehicle.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly fuel: FuelService,
    private readonly services: ServiceRecordsService,
    private readonly expenses: ExpensesService,
    private readonly categories: ExpenseCategoriesService,
    private readonly trips: TripBackupService,
    private readonly documents: DocumentsService,
  ) {}

  async export(userId: string, vehicleId?: string): Promise<Backup> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId, ...(vehicleId && { id: vehicleId }) },
      orderBy: { createdAt: "asc" },
    });
    if (vehicleId && !vehicles.length) throw new NotFoundException("Vehicle not found");
    const backedUp: BackupVehicle[] = [];
    for (const vehicle of vehicles) backedUp.push(await this.vehicleBackup(userId, vehicle));
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      vehicles: backedUp,
      documents: vehicleId ? [] : await this.documentRows(userId, null),
    };
  }

  /** What a restore would do, without saving anything. */
  async preview(userId: string, backup: RestoreBackupValues): Promise<BackupRestoreReport> {
    const { plans, personal } = await this.plan(userId, backup);
    return {
      exportedAt: backup.exportedAt,
      vehicles: plans.map((plan) => plan.outcome),
      documents: {
        count: personal.documents.length,
        issues: personal.issues.slice(0, ISSUES_SHOWN),
      },
    };
  }

  async restore(userId: string, backup: RestoreBackupValues): Promise<BackupRestoreReport> {
    const { plans, personal } = await this.plan(userId, backup);
    for (const plan of plans) {
      if (plan.outcome.status === "NEW") await this.restoreVehicle(userId, plan);
    }
    let restoredPapers = 0;
    for (const { index, values } of personal.documents) {
      if (
        await this.attempt(personal.issues, "documents", index, () =>
          this.documents.create(userId, values),
        )
      )
        restoredPapers += 1;
    }
    return {
      exportedAt: backup.exportedAt,
      vehicles: plans.map((plan) => plan.outcome),
      documents: { count: restoredPapers, issues: personal.issues.slice(0, ISSUES_SHOWN) },
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  private async vehicleBackup(userId: string, row: VehicleRow): Promise<BackupVehicle> {
    const where = { userId, vehicleId: row.id };
    const [fills, records, expenses, trips, documents] = await Promise.all([
      this.prisma.fuelEntry.findMany({
        where,
        orderBy: [{ filledAt: "asc" }, { odometerKm: "asc" }],
      }),
      this.prisma.serviceRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.expense.findMany({
        where: { ...where, source: { in: BACKED_UP_SOURCES } },
        include: { category: true, subcategory: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      this.trips.backupRows(userId, row.id),
      this.documentRows(userId, row.id),
    ]);
    const {
      id: _id,
      profileCompletion: _completion,
      archivedAt,
      createdAt: _created,
      updatedAt: _updated,
      ...vehicle
    } = toVehicle(row);
    const refunds = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      if (expense.kind !== ExpenseKind.REFUND || !expense.refundOfId) continue;
      refunds.set(expense.refundOfId, [...(refunds.get(expense.refundOfId) ?? []), expense]);
    }
    return {
      vehicle: { ...vehicle, archived: archivedAt !== null },
      fuel: fills.map((fill) => ({
        backupId: fill.id,
        filledAt: fill.filledAt.toISOString(),
        odometerKm: fill.odometerKm,
        fuelType: fill.fuelType,
        quantity: fill.quantity.toFixed(3),
        pricePerUnit: fill.pricePerUnit.toFixed(3),
        totalAmount: fill.totalAmount.toFixed(2),
        isFullTank: fill.isFullTank,
        missedPrevious: fill.missedPrevious,
        stationName: fill.stationName,
        latitude: fill.latitude?.toNumber() ?? null,
        longitude: fill.longitude?.toNumber() ?? null,
        location: fill.location,
        paymentMethod: fill.paymentMethod,
        notes: fill.notes,
      })),
      // Schedules and tracked parts aren't in the backup, so items lose those links.
      services: records.map((record) => {
        const input = toServiceRecordInput(record);
        return {
          ...input,
          items: input.items?.map(({ name, partNumber }) => ({ name, partNumber })),
        };
      }),
      expenses: expenses
        .filter((expense) => expense.kind === ExpenseKind.EXPENSE)
        .map((expense): BackupExpenseRow => {
          const {
            allocation: _allocation,
            categoryId: _category,
            subcategoryId: _subcategory,
            loanId: _loan,
            ...fields
          } = toExpenseInput(expense, [expense]);
          return {
            ...fields,
            category: this.ref(expense.category),
            subcategory: expense.subcategory && this.ref(expense.subcategory),
            refunds: (refunds.get(expense.id) ?? []).map((refund) => ({
              amount: refund.amount.toFixed(2),
              date: refund.date.toISOString().slice(0, 10),
              reason: refund.refundReason!,
              notes: refund.notes,
            })),
          };
        }),
      trips: trips as unknown as Record<string, unknown>[],
      documents,
    };
  }

  private ref(category: CategoryRow): BackupCategoryRef {
    return {
      key: category.key,
      name: category.name,
      icon: category.icon,
      costClass: category.costClass,
    };
  }

  private async documentRows(
    userId: string,
    vehicleId: string | null,
  ): Promise<BackupDocumentRow[]> {
    const rows = await this.prisma.document.findMany({
      where: { userId, vehicleId },
      include: DOCUMENT_WITH,
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => {
      const { vehicleId: _vehicle, fileIds: _files, ...fields } = toDocumentInput(row);
      return fields;
    });
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  private async plan(userId: string, backup: RestoreBackupValues) {
    const [owned, categories, papers] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { userId }, select: { registrationNumber: true } }),
      this.prisma.expenseCategory.findMany({ where: { OR: [{ userId: null }, { userId }] } }),
      this.prisma.document.findMany({
        where: { userId, vehicleId: null },
        select: { type: true, name: true, number: true },
      }),
    ]);
    const taken = new Set(owned.map((vehicle) => vehicle.registrationNumber));
    const plans = backup.vehicles.map((entry, index) => {
      const plan = this.planVehicle(entry, index, categories);
      const registration = plan.vehicle?.registrationNumber;
      if (registration && taken.has(registration)) {
        plan.outcome.status = "EXISTS";
        plan.outcome.counts = emptyCounts();
      }
      if (registration) taken.add(registration);
      return plan;
    });
    // Papers that aren't a vehicle's have no registration to match: the same type, name and
    // number as one already kept is taken to be it.
    const paperKey = (paper: { type: string; name: string; number?: string | null }) =>
      `${paper.type}|${paper.name.trim().toLowerCase()}|${paper.number?.trim().toLowerCase() ?? ""}`;
    const keptPapers = new Set(papers.map(paperKey));
    const personalIssues: BackupIssue[] = [];
    const personal = {
      issues: personalIssues,
      documents: this.validRows(backup.documents, "documents", personalIssues, (row) =>
        createDocumentSchema.safeParse({ ...row, vehicleId: null, fileIds: [] }),
      ).filter(({ index, values }) => {
        const key = paperKey(values);
        if (!keptPapers.has(key)) return keptPapers.add(key);
        personalIssues.push({ section: "documents", index, message: "Already in your documents" });
        return false;
      }),
    };
    return { plans, personal };
  }

  private planVehicle(
    entry: RestoreBackupValues["vehicles"][number],
    index: number,
    categories: CategoryRow[],
  ): VehiclePlan {
    const issues: BackupIssue[] = [];
    const parsed = createVehicleSchema.safeParse(entry.vehicle);
    const outcome: BackupVehicleOutcome = {
      index,
      name: vehicleName(entry.vehicle),
      registrationNumber:
        typeof entry.vehicle.registrationNumber === "string"
          ? entry.vehicle.registrationNumber
          : "",
      status: parsed.success ? "NEW" : "INVALID",
      vehicleId: null,
      counts: emptyCounts(),
      issues: [],
      issueCount: 0,
    };
    const plan: VehiclePlan = {
      outcome,
      issues,
      vehicle: null,
      archived: entry.vehicle.archived === true,
      fuel: [],
      services: [],
      expenses: [],
      trips: [],
      documents: [],
    };
    if (!parsed.success) {
      issues.push({ section: "vehicle", index, message: firstMessage(parsed.error) });
      return this.summarise(plan);
    }
    const { id: _id, ...vehicle } = parsed.data;
    plan.vehicle = vehicle;
    outcome.registrationNumber = vehicle.registrationNumber;

    plan.fuel = entry.fuel
      .map((row, rowIndex) => ({ row, rowIndex }))
      .flatMap(({ row, rowIndex }) => {
        const result = createFuelEntrySchema.safeParse(row);
        if (!result.success) {
          issues.push({ section: "fuel", index: rowIndex, message: firstMessage(result.error) });
          return [];
        }
        const { id: _fill, ...values } = result.data;
        const backupId = typeof row.backupId === "string" ? row.backupId : null;
        return [{ index: rowIndex, values, backupId }];
      })
      // Oldest first, so each reading lands after the ones before it.
      .sort((a, b) => a.values.filledAt.localeCompare(b.values.filledAt));
    plan.services = this.validRows(entry.services, "services", issues, (row) =>
      createServiceRecordSchema.safeParse(row),
    );
    plan.expenses = entry.expenses.flatMap((row, rowIndex) => {
      const planned = this.planExpense(row, categories);
      if (typeof planned === "string") {
        issues.push({ section: "expenses", index: rowIndex, message: planned });
        return [];
      }
      return [{ ...planned, index: rowIndex }];
    });
    entry.trips.forEach((row, rowIndex) => {
      if (isTripRow(row)) plan.trips.push({ index: rowIndex, row });
      else issues.push({ section: "trips", index: rowIndex, message: "This trip can't be read" });
    });
    plan.documents = this.validRows(entry.documents, "documents", issues, (row) =>
      createDocumentSchema.safeParse({ ...row, vehicleId: PLACEHOLDER_ID, fileIds: [] }),
    );
    outcome.counts = {
      fuel: plan.fuel.length,
      services: plan.services.length,
      expenses: plan.expenses.length,
      trips: plan.trips.length,
      documents: plan.documents.length,
    };
    return this.summarise(plan);
  }

  /** Checks an expense row and its category (a missing one of the user's own will be created). */
  private planExpense(
    row: Record<string, unknown>,
    categories: CategoryRow[],
  ): Omit<PlannedExpense, "index"> | string {
    const category = categoryRefSchema.safeParse(row.category);
    const subcategory = categoryRefSchema.nullable().safeParse(row.subcategory ?? null);
    if (!category.success || !subcategory.success) return "This expense has no category";
    const top = this.findCategory(categories, category.data, null);
    if (!top && (category.data.key || !category.data.costClass)) {
      return `No category called "${category.data.name}".`;
    }
    if (top && !top.active) return `The category "${top.name}" is disabled.`;
    const refunds = Array.isArray(row.refunds) ? row.refunds : [];
    const parsedRefunds = refunds.map((refund) => createRefundSchema.safeParse(refund));
    const badRefund = parsedRefunds.find((refund) => !refund.success);
    if (badRefund?.error) return firstMessage(badRefund.error);
    const result = createExpenseSchema.safeParse({
      ...row,
      allocation: { mode: "single", vehicleId: PLACEHOLDER_ID },
      categoryId: PLACEHOLDER_ID,
      subcategoryId: subcategory.data ? PLACEHOLDER_ID : null,
      loanId: null,
    });
    if (!result.success) return firstMessage(result.error);
    const { id: _id, ...values } = result.data;
    return {
      values,
      category: category.data,
      subcategory: subcategory.data,
      refunds: parsedRefunds.flatMap((refund) => (refund.success ? [refund.data] : [])),
    };
  }

  private findCategory(categories: CategoryRow[], ref: BackupCategoryRef, parentId: string | null) {
    const name = ref.name.toLowerCase();
    return (
      (ref.key && categories.find((item) => item.key === ref.key && item.parentId === parentId)) ||
      categories.find((item) => item.parentId === parentId && item.name.toLowerCase() === name) ||
      null
    );
  }

  private validRows<T>(
    rows: Record<string, unknown>[],
    section: BackupSection,
    issues: BackupIssue[],
    parse: (row: Record<string, unknown>) => z.ZodSafeParseResult<T>,
  ): Planned<Omit<T, "id">>[] {
    return rows.flatMap((row, index) => {
      const result = parse(row);
      if (!result.success) {
        issues.push({ section, index, message: firstMessage(result.error) });
        return [];
      }
      const { id: _id, ...values } = result.data as T & { id?: unknown };
      return [{ index, values }];
    });
  }

  private summarise(plan: VehiclePlan): VehiclePlan {
    plan.outcome.issues = plan.issues.slice(0, ISSUES_SHOWN);
    plan.outcome.issueCount = plan.issues.length;
    return plan;
  }

  /** Runs one row's create; a module's refusal skips the row with its reason. */
  private async attempt(
    issues: BackupIssue[],
    section: BackupSection,
    index: number,
    create: () => Promise<unknown>,
  ): Promise<boolean> {
    try {
      await create();
      return true;
    } catch (error) {
      const message = refusal(error);
      if (message === null) throw error;
      issues.push({ section, index, message });
      return false;
    }
  }

  private async restoreVehicle(userId: string, plan: VehiclePlan) {
    const { outcome, issues } = plan;
    let vehicleId: string;
    try {
      vehicleId = (await this.vehicles.create(userId, plan.vehicle!)).id;
    } catch (error) {
      const message = refusal(error);
      if (message === null) throw error;
      outcome.status = "EXISTS";
      outcome.counts = emptyCounts();
      return;
    }
    const counts = emptyCounts();
    const documentIds: string[] = [];
    try {
      const fillIds = new Map<string, string>();
      for (const { index, values, backupId } of plan.fuel) {
        const ok = await this.attempt(issues, "fuel", index, async () => {
          const fill = await this.fuel.create(userId, vehicleId, values);
          if (backupId) fillIds.set(backupId, fill.id);
        });
        if (ok) counts.fuel += 1;
      }
      for (const { index, values } of plan.services) {
        if (
          await this.attempt(issues, "services", index, () =>
            this.services.create(userId, vehicleId, values),
          )
        )
          counts.services += 1;
      }
      const categoryIds = new Map<string, string>();
      for (const expense of plan.expenses) {
        const ok = await this.attempt(issues, "expenses", expense.index, async () => {
          const categoryId = await this.categoryId(userId, expense.category, null, categoryIds);
          const subcategoryId =
            expense.subcategory &&
            (await this.categoryId(userId, expense.subcategory, categoryId, categoryIds));
          const created = await this.expenses.create(userId, {
            ...expense.values,
            allocation: { mode: "single", vehicleId },
            categoryId,
            subcategoryId,
          });
          for (const refund of expense.refunds)
            await this.expenses.refund(userId, created.id, refund);
        });
        if (ok) counts.expenses += 1;
      }
      if (plan.trips.length) {
        const result = await this.prisma.$transaction(
          (tx) =>
            this.trips.restoreRows(
              tx,
              userId,
              vehicleId,
              plan.trips.map((trip) => trip.row),
              { fuelEntryIds: fillIds },
            ),
          { timeout: 60_000 },
        );
        counts.trips = result.restored;
        for (const skipped of result.skipped) {
          issues.push({
            section: "trips",
            index: plan.trips[skipped.index]?.index ?? skipped.index,
            message: skipped.reason,
          });
        }
      }
      for (const { index, values } of plan.documents) {
        await this.attempt(issues, "documents", index, async () => {
          documentIds.push((await this.documents.create(userId, { ...values, vehicleId })).id);
        });
      }
      counts.documents = documentIds.length;
      if (plan.archived) await this.vehicles.archive(userId, vehicleId);
      outcome.status = "RESTORED";
      outcome.vehicleId = vehicleId;
      outcome.counts = counts;
    } catch (error) {
      // Everything recorded against the vehicle cascades with it; papers would only be unlinked.
      this.logger.error({ err: error, vehicleId }, "Restoring a vehicle failed; undone");
      await this.prisma.document.deleteMany({ where: { id: { in: documentIds } } });
      await this.prisma.vehicle.deleteMany({ where: { id: vehicleId, userId } });
      outcome.status = "FAILED";
      outcome.counts = emptyCounts();
      issues.push({
        section: "vehicle",
        index: outcome.index,
        message: "Something went wrong restoring this vehicle, so none of it was kept. Try again.",
      });
    }
    this.summarise(plan);
  }

  /** The category's id, creating one of the user's own when it's missing. */
  private async categoryId(
    userId: string,
    ref: BackupCategoryRef,
    parentId: string | null,
    cache: Map<string, string>,
  ): Promise<string> {
    const cacheKey = `${parentId ?? ""}|${ref.key ?? ""}|${ref.name.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const visible = await this.prisma.expenseCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], parentId },
    });
    let id = this.findCategory(visible, ref, parentId)?.id;
    if (!id) {
      const values = createExpenseCategorySchema.safeParse({
        name: ref.name,
        icon: ref.icon,
        ...(parentId ? { parentId } : { costClass: ref.costClass }),
      });
      if (!values.success) {
        throw new BadRequestException(`The category "${ref.name}" can't be created`);
      }
      id = (await this.categories.create(userId, values.data)).id;
    }
    cache.set(cacheKey, id);
    return id;
  }
}
