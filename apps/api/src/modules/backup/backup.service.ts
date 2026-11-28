import { randomUUID } from "node:crypto";

import {
  type Backup,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupCategoryRef,
  type BackupCounts,
  type BackupDocumentRow,
  type BackupExpenseRow,
  type BackupFileLink,
  type BackupFileRef,
  type BackupFileTarget,
  type BackupIssue,
  type BackupRestoreReport,
  type BackupSection,
  type BackupVehicle,
  type BackupVehicleOutcome,
  CostClass,
  createBudgetSchema,
  type CreateBudgetValues,
  createComponentSchema,
  type CreateComponentValues,
  createDocumentSchema,
  type CreateDocumentValues,
  createExpenseCategorySchema,
  createExpenseSchema,
  type CreateExpenseValues,
  createFuelEntrySchema,
  type CreateFuelEntryValues,
  createInspectionSchema,
  type CreateInspectionValues,
  createRecurringExpenseSchema,
  type CreateRecurringExpenseValues,
  createRefundSchema,
  type CreateRefundValues,
  createScheduleSchema,
  type CreateScheduleValues,
  createServiceRecordSchema,
  type CreateServiceRecordValues,
  createVehicleLoanSchema,
  type CreateVehicleLoanValues,
  createVehicleSchema,
  type CreateVehicleValues,
  ExpenseKind,
  ExpenseSource,
  loanRateChangeSchema,
  type LoanRateChangeValues,
  pageMeta,
  type PaginationQuery,
  RecurringStatus,
  restoreBackupSchema,
  type RestoreBackupValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";

import { Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type {
  ExpenseCategory as CategoryRow,
  Vehicle as VehicleRow,
} from "@/generated/prisma/client";
import { DOCUMENT_WITH, toDocumentInput } from "@/modules/documents/documents.mapper";
import { DocumentsService } from "@/modules/documents/documents.service";
import { ExpenseBudgetsService } from "@/modules/expenses/expense-budgets.service";
import { ExpenseCategoriesService } from "@/modules/expenses/expense-categories.service";
import { toExpenseInput } from "@/modules/expenses/expenses.mapper";
import { ExpensesService } from "@/modules/expenses/expenses.service";
import { RecurringExpensesService } from "@/modules/expenses/recurring-expenses.service";
import { VehicleLoansService } from "@/modules/expenses/vehicle-loans.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { ComponentsService } from "@/modules/maintenance/components.service";
import { InspectionsService } from "@/modules/maintenance/inspections.service";
import { toScheduleInput } from "@/modules/maintenance/maintenance.mapper";
import { MaintenanceService } from "@/modules/maintenance/maintenance.service";
import { RECORD_INCLUDE, toServiceRecordInput } from "@/modules/maintenance/service-record.mapper";
import { ServiceRecordsService } from "@/modules/maintenance/service-records.service";
import { type TripBackupRow, TripBackupService } from "@/modules/trips/trip-backup.service";
import { toVehicle } from "@/modules/vehicles/vehicles.mapper";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";
import { SIGNATURE_BYTES, sniffType } from "@/storage/file-signature";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";
import { ThumbnailService } from "@/storage/thumbnail.service";

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

const fileRefSchema = z.object({
  path: z.string().min(1).max(400),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(0),
});
/** A file's place in a ZIP backup: unique by the stored row's id. */
const filePath = (id: string, fileName: string) =>
  `files/${id}/${fileName.replace(/[^\w.\- ]+/g, "_")}`;
const fileRefs = (value: unknown): BackupFileRef[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = fileRefSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const LINK_SECONDS = 15 * 60;
const backupIdOf = (row: Record<string, unknown>) =>
  typeof row.backupId === "string" ? row.backupId : null;

type Planned<T> = { index: number; values: T };
type WithFiles<T> = T & { files: BackupFileRef[] };
type PlannedExpense = Planned<CreateExpenseValues> & {
  category: BackupCategoryRef;
  subcategory: BackupCategoryRef | null;
  refunds: CreateRefundValues[];
  loanBackupId: string | null;
  files: BackupFileRef[];
};
interface VehiclePlan {
  outcome: BackupVehicleOutcome;
  issues: BackupIssue[];
  vehicle: CreateVehicleValues | null;
  archived: boolean;
  fuel: (Planned<CreateFuelEntryValues> & { backupId: string | null })[];
  services: WithFiles<Planned<CreateServiceRecordValues>>[];
  expenses: PlannedExpense[];
  trips: { index: number; row: TripBackupRow }[];
  documents: WithFiles<Planned<CreateDocumentValues>>[];
  components: WithFiles<Planned<Omit<CreateComponentValues, "id">> & { backupId: string | null }>[];
  /** Each item's part as its backup id (aligned with `values.items`). */
  inspections: WithFiles<
    Planned<Omit<CreateInspectionValues, "id">> & { componentBackupIds: (string | null)[] }
  >[];
  schedules: (Planned<Omit<CreateScheduleValues, "id">> & { componentBackupId: string | null })[];
  loans: (Planned<CreateVehicleLoanValues> & {
    backupId: string | null;
    rateChanges: LoanRateChangeValues[];
  })[];
  recurring: (Planned<CreateRecurringExpenseValues> & {
    category: BackupCategoryRef;
    subcategory: BackupCategoryRef | null;
    paused: boolean;
  })[];
  budgets: (Planned<CreateBudgetValues> & { category: BackupCategoryRef | null })[];
  /** Filled while restoring: where this vehicle's files go. */
  files: BackupFileTarget[];
}

const emptyCounts = (): BackupCounts => ({
  fuel: 0,
  services: 0,
  expenses: 0,
  trips: 0,
  documents: 0,
  components: 0,
  inspections: 0,
  schedules: 0,
  loans: 0,
  recurring: 0,
  budgets: 0,
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
    private readonly components: ComponentsService,
    private readonly inspections: InspectionsService,
    private readonly schedules: MaintenanceService,
    private readonly loans: VehicleLoansService,
    private readonly recurring: RecurringExpensesService,
    private readonly budgets: ExpenseBudgetsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly thumbs: ThumbnailService,
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
      profilePhoto: vehicleId ? null : await this.profilePhoto(userId),
    };
  }

  /**
   * Moves one vehicle with everything recorded against it to another account: the sender's
   * export restored into the recipient through each module's create rules, its files copied in
   * storage, then the sender's vehicle and its papers deleted. All or nothing: a row that
   * wouldn't come across stops the move. Returns the recipient's new vehicle id.
   */
  async moveVehicle(fromUserId: string, toUserId: string, vehicleId: string): Promise<string> {
    const backup = restoreBackupSchema.parse(
      JSON.parse(JSON.stringify(await this.export(fromUserId, vehicleId))),
    );
    const plan = (await this.plan(toUserId, backup)).plans[0]!;
    if (plan.outcome.status === "EXISTS") {
      throw new ConflictException("A vehicle with this registration is already in your garage.");
    }
    // Checked through a copy: restoreVehicle changes the outcome afterwards.
    const planned = plan.outcome.status;
    if (planned !== "NEW" || plan.issues.length) {
      throw new ConflictException(
        `This vehicle can't be moved: ${plan.issues[0]?.message ?? "its details can't be read"}`,
      );
    }
    await this.restoreVehicle(toUserId, plan);
    const { status, vehicleId: newVehicleId } = plan.outcome;
    if (status !== "RESTORED" || !newVehicleId) {
      throw new ConflictException("Moving this vehicle failed, so nothing changed. Try again.");
    }
    const undo = async () => {
      await this.prisma.document.deleteMany({
        where: { userId: toUserId, vehicleId: newVehicleId },
      });
      await this.prisma.vehicle.deleteMany({ where: { id: newVehicleId, userId: toUserId } });
    };
    if (plan.issues.length) {
      await undo();
      throw new ConflictException(`This vehicle can't be moved: ${plan.issues[0]!.message}`);
    }
    try {
      await this.copyFiles(fromUserId, toUserId, vehicleId, plan.files);
    } catch (error) {
      await undo();
      throw error;
    }
    await this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { userId: fromUserId, vehicleId } }),
      this.prisma.vehicle.deleteMany({ where: { id: vehicleId, userId: fromUserId } }),
    ]);
    return newVehicleId;
  }

  /** Copies the sender's stored files to the recipient's restored records (already checked once). */
  private async copyFiles(
    fromUserId: string,
    toUserId: string,
    vehicleId: string,
    targets: BackupFileTarget[],
  ) {
    if (!targets.length) return;
    const sources = new Map(
      (await this.storedFiles(fromUserId, vehicleId)).map((file) => [file.path, file.key]),
    );
    const owner = {
      expense: "expenseId",
      "service-record": "serviceRecordId",
      component: "componentId",
      inspection: "inspectionId",
    } as const;
    for (const target of targets) {
      const source = sources.get(target.path);
      if (!source || !target.id) continue;
      // shortcut: an object copied just before a failed row create stays until cleaned by hand; rare.
      const bytes = await this.storage.get(source);
      const key = `users/${toUserId}/${randomUUID()}`;
      await this.storage.put(key, bytes, target.contentType);
      const file = {
        userId: toUserId,
        key,
        fileName: target.fileName,
        contentType: target.contentType,
        size: bytes.length,
        confirmedAt: new Date(),
      };
      if (target.kind === "trip") {
        await this.prisma.tripAttachment.create({
          data: { ...file, tripId: target.id, costId: target.costId ?? null },
        });
        continue;
      }
      const thumbKey = await this.thumbs.make(toUserId, key, target.contentType);
      if (target.kind === "document") {
        await this.prisma.documentFile.create({
          data: { ...file, thumbKey, documentId: target.id },
        });
      } else if (target.kind !== "avatar") {
        await this.prisma.attachment.create({
          data: { ...file, thumbKey, [owner[target.kind]]: target.id },
        });
      }
    }
  }

  /** Short-lived links to every file the backup refers to, for the web to pack into a ZIP. */
  async fileLinks(userId: string, vehicleId: string | undefined, page: PaginationQuery) {
    const files = await this.storedFiles(userId, vehicleId);
    const start = (page.page - 1) * page.pageSize;
    const links: BackupFileLink[] = await Promise.all(
      files.slice(start, start + page.pageSize).map(async (file) => ({
        path: file.path,
        url: await this.storage.createDownloadUrl(file.key, LINK_SECONDS, file.fileName),
      })),
    );
    return new Paginated(links, pageMeta(page, files.length));
  }

  /** The stored objects behind the backup's file references, path to key. */
  private async storedFiles(userId: string, vehicleId?: string) {
    const ofVehicle = vehicleId ? { vehicleId } : {};
    const [documentFiles, attachments, tripFiles, user] = await Promise.all([
      this.prisma.documentFile.findMany({
        where: {
          userId,
          confirmedAt: { not: null },
          document: vehicleId ? { vehicleId } : { isNot: null },
        },
      }),
      this.prisma.attachment.findMany({
        where: {
          userId,
          confirmedAt: { not: null },
          OR: [
            { expense: { source: { in: BACKED_UP_SOURCES }, ...ofVehicle } },
            // `{}` on an optional relation matches nothing: "linked" must be said outright.
            { serviceRecord: vehicleId ? { vehicleId } : { isNot: null } },
            { component: { ...ofVehicle, removedAt: null } },
            { inspection: vehicleId ? { vehicleId } : { isNot: null } },
          ],
        },
      }),
      this.prisma.tripAttachment.findMany({
        where: { userId, confirmedAt: { not: null }, trip: ofVehicle },
      }),
      vehicleId ? null : this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    const files = [...documentFiles, ...attachments, ...tripFiles].map((file) => ({
      path: filePath(file.id, file.fileName),
      key: file.key,
      fileName: file.fileName,
    }));
    if (user?.avatarKey) {
      files.push({ path: "files/profile-photo", key: user.avatarKey, fileName: "profile-photo" });
    }
    return files;
  }

  private async profilePhoto(userId: string): Promise<BackupFileRef | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.avatarKey) return null;
    try {
      const size = await this.storage.size(user.avatarKey);
      const type = size
        ? sniffType(await this.storage.head(user.avatarKey, SIGNATURE_BYTES))
        : null;
      if (!size || !type) return null;
      return { path: "files/profile-photo", fileName: "profile-photo", contentType: type, size };
    } catch {
      return null; // storage not reachable: the backup goes without the photo
    }
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
      fileCount:
        plans
          .filter((plan) => plan.outcome.status === "NEW")
          .reduce(
            (sum, plan) =>
              sum +
              [...plan.services, ...plan.expenses, ...plan.documents].reduce(
                (count, row) => count + row.files.length,
                0,
              ),
            0,
          ) +
        personal.documents.reduce((sum, row) => sum + row.files.length, 0) +
        (personal.photo ? 1 : 0),
      files: [],
    };
  }

  async restore(userId: string, backup: RestoreBackupValues): Promise<BackupRestoreReport> {
    const { plans, personal } = await this.plan(userId, backup);
    for (const plan of plans) {
      if (plan.outcome.status === "NEW") await this.restoreVehicle(userId, plan);
    }
    let restoredPapers = 0;
    const files = plans.flatMap((plan) => plan.files);
    for (const { index, values, files: refs } of personal.documents) {
      if (
        await this.attempt(personal.issues, "documents", index, async () => {
          const created = await this.documents.create(userId, values);
          files.push(...this.targets(refs, "document", created.id));
        })
      )
        restoredPapers += 1;
    }
    if (personal.photo) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      // Never replaces a photo the account already has.
      if (!user?.avatarKey) files.push(...this.targets([personal.photo], "avatar", null));
    }
    return {
      exportedAt: backup.exportedAt,
      vehicles: plans.map((plan) => plan.outcome),
      documents: { count: restoredPapers, issues: personal.issues.slice(0, ISSUES_SHOWN) },
      fileCount: files.length,
      files,
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  private async vehicleBackup(userId: string, row: VehicleRow): Promise<BackupVehicle> {
    const where = { userId, vehicleId: row.id };
    const [
      fills,
      records,
      expenses,
      trips,
      documents,
      parts,
      inspections,
      schedules,
      loans,
      recurring,
      budgets,
    ] = await Promise.all([
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
      this.prisma.vehicleComponent.findMany({
        where: { ...where, removedAt: null },
        include: { provider: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.inspection.findMany({
        where,
        include: {
          provider: { select: { name: true } },
          items: { orderBy: { position: "asc" } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.maintenanceSchedule.findMany({ where, orderBy: { createdAt: "asc" } }),
      this.prisma.vehicleLoan.findMany({
        where,
        include: { recurring: true, rateChanges: { orderBy: { effectiveFrom: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.recurringExpense.findMany({
        where: {
          ...where,
          loanId: null,
          status: { in: [RecurringStatus.ACTIVE, RecurringStatus.PAUSED] },
        },
        include: { category: true, subcategory: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.expenseBudget.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const attachments = await this.prisma.attachment.findMany({
      where: {
        userId,
        confirmedAt: { not: null },
        OR: [
          { expenseId: { in: expenses.map((expense) => expense.id) } },
          { serviceRecordId: { in: records.map((record) => record.id) } },
          { componentId: { in: parts.map((part) => part.id) } },
          { inspectionId: { in: inspections.map((inspection) => inspection.id) } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    const filesOf = (
      owner: "expenseId" | "serviceRecordId" | "componentId" | "inspectionId",
      id: string,
    ): BackupFileRef[] =>
      attachments
        .filter((file) => file[owner] === id)
        .map((file) => ({
          path: filePath(file.id, file.fileName),
          fileName: file.fileName,
          contentType: file.contentType,
          size: file.size,
        }));
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
          files: filesOf("serviceRecordId", record.id),
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
            loanBackupId: expense.loanId,
            files: filesOf("expenseId", expense.id),
          };
        }),
      trips: trips as unknown as Record<string, unknown>[],
      documents,
      components: parts.map((part) => ({
        backupId: part.id,
        kind: part.kind,
        name: part.name,
        position: part.position,
        brand: part.brand,
        partNumber: part.partNumber,
        installedAt: day(part.installedAt),
        installedKm: part.installedKm,
        providerName: part.provider?.name ?? null,
        expectedLifeKm: part.expectedLifeKm,
        expectedLifeMonths: part.expectedLifeMonths,
        warrantyUntil: day(part.warrantyUntil),
        warrantyKm: part.warrantyKm,
        notes: part.notes,
        files: filesOf("componentId", part.id),
      })),
      // Follow-up schedule links aren't kept (a restored schedule is a new one).
      inspections: inspections.map((inspection) => ({
        kind: inspection.kind,
        templateKey: inspection.templateKey,
        title: inspection.title,
        date: day(inspection.date),
        odometerKm: inspection.odometerKm,
        inspector: inspection.inspector,
        providerName: inspection.provider?.name ?? null,
        followUpDate: day(inspection.followUpDate),
        notes: inspection.notes,
        items: inspection.items.map((item) => ({
          area: item.area,
          label: item.label,
          condition: item.condition,
          notes: item.notes,
          recommendedAction: item.recommendedAction,
          componentBackupId: item.componentId,
        })),
        files: filesOf("inspectionId", inspection.id),
      })),
      schedules: schedules.map((schedule) => {
        const { componentId, ...input } = toScheduleInput(schedule);
        return { ...input, componentBackupId: componentId };
      }),
      loans: loans.map((loan) => ({
        backupId: loan.id,
        lender: loan.lender,
        accountNumber: loan.accountNumber,
        principal: loan.principal.toFixed(2),
        annualRate: loan.annualRate.toFixed(2),
        tenureMonths: loan.tenureMonths,
        firstEmiDate: day(loan.firstEmiDate),
        method: loan.method,
        processingFee: loan.processingFee?.toFixed(2) ?? null,
        paymentMethod: loan.recurring?.paymentMethod ?? null,
        reminderDays: loan.recurring?.reminderDays ?? 3,
        rateChanges: loan.rateChanges.map((change) => ({
          effectiveFrom: day(change.effectiveFrom),
          annualRate: change.annualRate.toFixed(2),
          keepEmi: change.keepEmi,
        })),
      })),
      recurring: recurring.map((schedule) => ({
        title: schedule.title,
        amount: schedule.amount.toFixed(2),
        category: this.ref(schedule.category),
        subcategory: schedule.subcategory && this.ref(schedule.subcategory),
        paymentMethod: schedule.paymentMethod,
        vendor: schedule.vendor,
        notes: schedule.notes,
        every: schedule.every,
        unit: schedule.unit,
        startDate: day(schedule.startDate),
        endDate: day(schedule.endDate),
        reminderDays: schedule.reminderDays,
        paused: schedule.status === RecurringStatus.PAUSED,
      })),
      budgets: budgets.map((budget) => ({
        category: budget.category && this.ref(budget.category),
        period: budget.period,
        amount: budget.amount.toFixed(2),
        alertPercent: budget.alertPercent,
      })),
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
      return {
        ...fields,
        files: row.files
          .filter((file) => file.confirmedAt)
          .map((file) => ({
            path: filePath(file.id, file.fileName),
            fileName: file.fileName,
            contentType: file.contentType,
            size: file.size,
          })),
      };
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
      photo: fileRefs([backup.profilePhoto])[0] ?? null,
      documents: this.withFiles(
        backup.documents,
        this.validRows(backup.documents, "documents", personalIssues, (row) =>
          createDocumentSchema.safeParse({ ...row, vehicleId: null, fileIds: [] }),
        ),
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
      components: [],
      inspections: [],
      schedules: [],
      loans: [],
      recurring: [],
      budgets: [],
      files: [],
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
    plan.services = this.withFiles(
      entry.services,
      this.validRows(entry.services, "services", issues, (row) =>
        createServiceRecordSchema.safeParse(row),
      ),
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
    plan.documents = this.withFiles(
      entry.documents,
      this.validRows(entry.documents, "documents", issues, (row) =>
        createDocumentSchema.safeParse({ ...row, vehicleId: PLACEHOLDER_ID, fileIds: [] }),
      ),
    );
    plan.components = this.withFiles(
      entry.components,
      this.validRows(entry.components, "components", issues, (row) =>
        createComponentSchema.safeParse(row),
      ).map((item) => ({ ...item, backupId: backupIdOf(entry.components[item.index]!) })),
    );
    plan.inspections = this.withFiles(
      entry.inspections,
      this.validRows(entry.inspections, "inspections", issues, (row) =>
        createInspectionSchema.safeParse({
          ...row,
          items: Array.isArray(row.items)
            ? row.items.map((item: unknown) => ({ ...(item as object), componentId: null }))
            : row.items,
        }),
      ).map((item) => {
        const items = entry.inspections[item.index]!.items;
        return {
          ...item,
          componentBackupIds: item.values.items.map((_, at) => {
            const link: unknown = Array.isArray(items)
              ? (items[at] as Record<string, unknown> | undefined)?.componentBackupId
              : null;
            return typeof link === "string" ? link : null;
          }),
        };
      }),
    );
    plan.schedules = this.validRows(entry.schedules, "schedules", issues, (row) =>
      createScheduleSchema.safeParse({ ...row, componentId: null }),
    ).map((item) => {
      const link = entry.schedules[item.index]!.componentBackupId;
      return { ...item, componentBackupId: typeof link === "string" ? link : null };
    });
    plan.loans = this.validRows(entry.loans, "loans", issues, (row) =>
      createVehicleLoanSchema.safeParse({ ...row, vehicleId: PLACEHOLDER_ID }),
    ).map((item) => {
      const changes = entry.loans[item.index]!.rateChanges;
      const rateChanges = (Array.isArray(changes) ? changes : []).flatMap((change) => {
        const parsed = loanRateChangeSchema.safeParse(change);
        if (parsed.success) return [parsed.data];
        issues.push({
          section: "loans",
          index: item.index,
          message: `A rate change was left out: ${firstMessage(parsed.error)}`,
        });
        return [];
      });
      return { ...item, backupId: backupIdOf(entry.loans[item.index]!), rateChanges };
    });
    plan.recurring = entry.recurring.flatMap((row, rowIndex) => {
      const category = categoryRefSchema.safeParse(row.category);
      const subcategory = categoryRefSchema.nullable().safeParse(row.subcategory ?? null);
      if (!category.success || !subcategory.success) {
        issues.push({ section: "recurring", index: rowIndex, message: "It has no category" });
        return [];
      }
      const result = createRecurringExpenseSchema.safeParse({
        ...row,
        vehicleId: PLACEHOLDER_ID,
        categoryId: PLACEHOLDER_ID,
        subcategoryId: subcategory.data ? PLACEHOLDER_ID : null,
      });
      if (!result.success) {
        issues.push({ section: "recurring", index: rowIndex, message: firstMessage(result.error) });
        return [];
      }
      return [
        {
          index: rowIndex,
          values: result.data,
          category: category.data,
          subcategory: subcategory.data,
          paused: row.paused === true,
        },
      ];
    });
    plan.budgets = entry.budgets.flatMap((row, rowIndex) => {
      const category = categoryRefSchema.nullable().safeParse(row.category ?? null);
      const result = createBudgetSchema.safeParse({
        ...row,
        vehicleId: PLACEHOLDER_ID,
        categoryId: category.success && category.data ? PLACEHOLDER_ID : null,
      });
      if (!category.success || !result.success) {
        issues.push({
          section: "budgets",
          index: rowIndex,
          message: result.success ? "Its category can't be read" : firstMessage(result.error),
        });
        return [];
      }
      return [{ index: rowIndex, values: result.data, category: category.data }];
    });
    outcome.counts = {
      fuel: plan.fuel.length,
      services: plan.services.length,
      expenses: plan.expenses.length,
      trips: plan.trips.length,
      documents: plan.documents.length,
      components: plan.components.length,
      inspections: plan.inspections.length,
      schedules: plan.schedules.length,
      loans: plan.loans.length,
      recurring: plan.recurring.length,
      budgets: plan.budgets.length,
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
      loanBackupId: typeof row.loanBackupId === "string" ? row.loanBackupId : null,
      files: fileRefs(row.files),
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

  /** Each planned row with the file references of the backup row it came from. */
  private withFiles<T extends { index: number }>(
    rows: Record<string, unknown>[],
    planned: T[],
  ): WithFiles<T>[] {
    return planned.map((item) => ({ ...item, files: fileRefs(rows[item.index]?.files) }));
  }

  private targets(
    refs: BackupFileRef[],
    kind: BackupFileTarget["kind"],
    id: string | null,
  ): BackupFileTarget[] {
    return refs.map((ref) => ({
      path: ref.path,
      fileName: ref.fileName,
      contentType: ref.contentType,
      kind,
      id,
    }));
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
      const partIds = new Map<string, string>();
      for (const { index, values, backupId, files } of plan.components) {
        const ok = await this.attempt(issues, "components", index, async () => {
          const part = await this.components.create(userId, vehicleId, values);
          if (backupId) partIds.set(backupId, part.id);
          plan.files.push(...this.targets(files, "component", part.id));
        });
        if (ok) counts.components += 1;
      }
      for (const { index, values, componentBackupIds, files } of plan.inspections) {
        const ok = await this.attempt(issues, "inspections", index, async () => {
          const inspection = await this.inspections.create(userId, vehicleId, {
            ...values,
            items: values.items.map((item, at) => {
              const link = componentBackupIds[at];
              return { ...item, componentId: (link && partIds.get(link)) || null };
            }),
          });
          plan.files.push(...this.targets(files, "inspection", inspection.id));
        });
        if (ok) counts.inspections += 1;
      }
      const fillIds = new Map<string, string>();
      for (const { index, values, backupId } of plan.fuel) {
        const ok = await this.attempt(issues, "fuel", index, async () => {
          const fill = await this.fuel.create(userId, vehicleId, values);
          if (backupId) fillIds.set(backupId, fill.id);
        });
        if (ok) counts.fuel += 1;
      }
      for (const { index, values, files } of plan.services) {
        if (
          await this.attempt(issues, "services", index, async () => {
            const record = await this.services.create(userId, vehicleId, values);
            plan.files.push(...this.targets(files, "service-record", record.id));
          })
        )
          counts.services += 1;
      }
      // Loans first: EMI payments link to them. Tracked from today, so EMIs already paid aren't
      // owed again (their payments come back as expenses below).
      const loanIds = new Map<string, string>();
      for (const { index, values, backupId, rateChanges } of plan.loans) {
        let loanId: string | null = null;
        const ok = await this.attempt(issues, "loans", index, async () => {
          loanId = (await this.loans.create(userId, { ...values, vehicleId })).id;
          if (backupId) loanIds.set(backupId, loanId);
        });
        if (!ok || !loanId) continue;
        counts.loans += 1;
        // A refused change is reported; the loan stays.
        for (const change of rateChanges) {
          await this.attempt(issues, "loans", index, () =>
            this.loans.addRateChange(userId, loanId!, change),
          );
        }
      }
      const categoryIds = new Map<string, string>();
      for (const schedule of plan.recurring) {
        const ok = await this.attempt(issues, "recurring", schedule.index, async () => {
          const categoryId = await this.categoryId(userId, schedule.category, null, categoryIds);
          const subcategoryId =
            schedule.subcategory &&
            (await this.categoryId(userId, schedule.subcategory, categoryId, categoryIds));
          const created = await this.recurring.create(userId, {
            ...schedule.values,
            vehicleId,
            categoryId,
            subcategoryId,
          });
          if (schedule.paused) {
            await this.recurring.setStatus(userId, created.id, RecurringStatus.PAUSED);
          }
        });
        if (ok) counts.recurring += 1;
      }
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
            loanId: (expense.loanBackupId && loanIds.get(expense.loanBackupId)) || null,
          });
          for (const refund of expense.refunds)
            await this.expenses.refund(userId, created.id, refund);
          plan.files.push(...this.targets(expense.files, "expense", created.id));
        });
        if (ok) counts.expenses += 1;
      }
      for (const budget of plan.budgets) {
        const ok = await this.attempt(issues, "budgets", budget.index, async () => {
          const categoryId =
            budget.category && (await this.categoryId(userId, budget.category, null, categoryIds));
          await this.budgets.create(userId, { ...budget.values, vehicleId, categoryId });
        });
        if (ok) counts.budgets += 1;
      }
      for (const { index, values, componentBackupId } of plan.schedules) {
        const ok = await this.attempt(issues, "schedules", index, () =>
          this.schedules.create(userId, vehicleId, {
            ...values,
            componentId: (componentBackupId && partIds.get(componentBackupId)) || null,
          }),
        );
        if (ok) counts.schedules += 1;
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
        plan.trips.forEach(({ row }, at) => {
          const tripId = result.ids[at];
          if (!tripId) return;
          for (const file of row.files ?? []) {
            plan.files.push({
              ...this.targets([file], "trip", tripId)[0]!,
              costId:
                file.costIndex === null ? null : (result.costIds[at]?.[file.costIndex] ?? null),
            });
          }
        });
        for (const skipped of result.skipped) {
          issues.push({
            section: "trips",
            index: plan.trips[skipped.index]?.index ?? skipped.index,
            message: skipped.reason,
          });
        }
      }
      for (const { index, values, files } of plan.documents) {
        await this.attempt(issues, "documents", index, async () => {
          const created = await this.documents.create(userId, { ...values, vehicleId });
          documentIds.push(created.id);
          plan.files.push(...this.targets(files, "document", created.id));
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
      plan.files = [];
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
