import { randomUUID } from "node:crypto";

import {
  createServiceRecordSchema,
  type CreateServiceRecordValues,
  MAINTENANCE_CATEGORY_KEYS,
  maintenanceCategoryName,
  pageMeta,
  type PaginationQuery,
  type ServiceRecord,
  type ServiceRecordFilters,
  type ServiceRecordListQuery,
  type ServiceRecordSummary,
  serviceRecordTotal,
  type UpdateServiceRecordValues,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma, type Vehicle } from "@/generated/prisma/client";
import { LinkedExpensesService, type Reading } from "@/modules/expenses/linked-expenses.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { toDbDate } from "./maintenance.mapper";
import { toMaintenanceExpense } from "./maintenance-expense";
import {
  RECORD_INCLUDE,
  type RecordRow,
  toServiceRecord,
  toServiceRecordInput,
} from "./service-record.mapper";

const NOT_FOUND = "Service record not found";
const km = new Intl.NumberFormat("en-IN");
const day = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" });
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });
/** Newest first; undated readings last within a day; stable for paging. */
const ORDER: Prisma.ServiceRecordOrderByWithRelationInput[] = [
  { serviceDate: "desc" },
  { odometerKm: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
  { id: "desc" },
];

/** The history filters as a query (docs/architecture/maintenance.md §3); always one vehicle's. */
function recordWhere(
  userId: string,
  vehicleId: string,
  filters: ServiceRecordFilters,
): Prisma.ServiceRecordWhereInput {
  const { scheduleId, search, from, to, group, type, providerId } = filters;
  const { minAmount, maxAmount, minKm, maxKm } = filters;
  const contains = search && { contains: search, mode: "insensitive" as const };
  // Category names live in shared code, so a name search becomes the matching keys.
  const categories =
    search &&
    MAINTENANCE_CATEGORY_KEYS.filter((key) =>
      maintenanceCategoryName(key).toLowerCase().includes(search.toLowerCase()),
    );
  return {
    userId,
    vehicleId,
    ...(scheduleId && { items: { some: { scheduleId } } }),
    ...(contains && {
      OR: [
        { title: contains },
        { description: contains },
        { notes: contains },
        { technician: contains },
        { provider: { name: contains } },
        { items: { some: { OR: [{ name: contains }, { partNumber: contains }] } } },
        ...(categories && categories.length ? [{ categoryKey: { in: categories } }] : []),
      ],
    }),
    ...((from || to) && {
      serviceDate: { ...(from && { gte: toDbDate(from)! }), ...(to && { lte: toDbDate(to)! }) },
    }),
    ...(group && { categoryKey: { startsWith: `${group}.` } }),
    ...(type && { type }),
    ...(providerId && { providerId }),
    ...((minAmount || maxAmount) && {
      totalAmount: { ...(minAmount && { gte: minAmount }), ...(maxAmount && { lte: maxAmount }) },
    }),
    ...((minKm != null || maxKm != null) && {
      odometerKm: { ...(minKm != null && { gte: minKm }), ...(maxKm != null && { lte: maxKm }) },
    }),
  };
}

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its maintenance.`,
    );
  }
}

/**
 * Service and repair records (docs/architecture/maintenance.md). A record joins the vehicle's one
 * odometer history, can complete schedules (its items), and keeps its money as one linked expense,
 * all in one transaction under the vehicle's lock.
 */
@Injectable()
export class ServiceRecordsService {
  private readonly logger = new Logger(ServiceRecordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly linked: LinkedExpensesService,
  ) {}

  async list(
    userId: string,
    vehicleId: string,
    query: ServiceRecordListQuery,
  ): Promise<Paginated<ServiceRecord>> {
    await this.vehicles.findOwned(userId, vehicleId);
    const where = recordWhere(userId, vehicleId, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        orderBy: ORDER,
        ...pageArgs(query),
      }),
      this.prisma.serviceRecord.count({ where }),
    ]);
    return new Paginated(await this.present(rows), pageMeta(query, total));
  }

  /** How many records match the filters and what they cost (every page). */
  async summary(
    userId: string,
    vehicleId: string,
    filters: ServiceRecordFilters,
  ): Promise<ServiceRecordSummary> {
    await this.vehicles.findOwned(userId, vehicleId);
    const { _count, _sum } = await this.prisma.serviceRecord.aggregate({
      where: recordWhere(userId, vehicleId, filters),
      _count: true,
      _sum: { totalAmount: true },
    });
    return { count: _count, totalAmount: (_sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2) };
  }

  /** The latest records and how many there are (the overview's "recent maintenance"). */
  async recent(userId: string, vehicleId: string, take: number) {
    const where = { userId, vehicleId };
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.serviceRecord.findMany({ where, include: RECORD_INCLUDE, orderBy: ORDER, take }),
      this.prisma.serviceRecord.count({ where }),
    ]);
    return { recent: await this.present(rows), count };
  }

  async get(userId: string, vehicleId: string, id: string): Promise<ServiceRecord> {
    await this.vehicles.findOwned(userId, vehicleId);
    const row = await this.prisma.serviceRecord.findFirst({
      where: { id, userId, vehicleId },
      include: RECORD_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return (await this.present([row]))[0]!;
  }

  async create(
    userId: string,
    vehicleId: string,
    input: CreateServiceRecordValues,
  ): Promise<ServiceRecord> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
      assertActive(vehicle);
      // A retried save (same client id) returns the record it already made.
      if (input.id) {
        const existing = await tx.serviceRecord.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const id = input.id ?? randomUUID();
      await this.write(tx, vehicle, id, input, null);
      return id;
    });
    this.logger.log(`Service record ${id} created`);
    return this.get(userId, vehicleId, id);
  }

  /** Merges onto the stored record and re-checks it whole; `items` replaces the list. */
  async update(
    userId: string,
    vehicleId: string,
    id: string,
    input: UpdateServiceRecordValues,
  ): Promise<ServiceRecord> {
    await this.prisma.$transaction(async (tx) => {
      const { vehicle, row } = await this.locked(tx, userId, vehicleId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      // A new breakdown recomputes the total; a stored total mustn't contradict it.
      const breakdownChanged = [
        "labourAmount",
        "partsAmount",
        "otherAmount",
        "taxAmount",
        "discountAmount",
      ].some((key) => key in changes);
      const stored = toServiceRecordInput(row);
      const parsed = createServiceRecordSchema.safeParse({
        ...stored,
        ...(breakdownChanged && !("totalAmount" in changes) && { totalAmount: null }),
        ...changes,
      });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      await this.write(tx, vehicle, id, parsed.data, row);
    });
    this.logger.log(`Service record ${id} updated`);
    return this.get(userId, vehicleId, id);
  }

  /** Removes its expense (and that expense's refunds) too. The vehicle keeps its odometer. */
  async remove(userId: string, vehicleId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, vehicleId, id);
      await tx.serviceRecord.delete({ where: { id } });
      await this.linked.remove(tx, "MAINTENANCE", id);
    });
    this.logger.log(`Service record ${id} deleted`);
  }

  /** A workshop's visits across the user's vehicles, newest first (the caller checks it's theirs). */
  async byProvider(
    userId: string,
    providerId: string,
    page: PaginationQuery,
  ): Promise<Paginated<ServiceRecord>> {
    const where = { userId, providerId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.serviceRecord.findMany({
        where,
        include: RECORD_INCLUDE,
        orderBy: ORDER,
        ...pageArgs(page),
      }),
      this.prisma.serviceRecord.count({ where }),
    ]);
    return new Paginated(await this.present(rows), pageMeta(page, total));
  }

  /**
   * A new record inside another module's write (a component replacement), under the vehicle's
   * lock the caller holds: the same checks, money and odometer handling as `create`.
   */
  createInTransaction(
    tx: Prisma.TransactionClient,
    vehicle: Vehicle,
    id: string,
    values: CreateServiceRecordValues,
  ) {
    return this.write(tx, vehicle, id, values, null);
  }

  /** Writes a validated record (new when `current` is null) with its items, money and reading. */
  private async write(
    tx: Prisma.TransactionClient,
    vehicle: Vehicle,
    id: string,
    values: CreateServiceRecordValues,
    current: RecordRow | null,
  ) {
    const items = values.items ?? [];
    await this.assertSchedules(tx, vehicle, id, values);
    if (values.odometerKm != null) {
      await this.assertOdometerInOrder(tx, vehicle.id, values.serviceDate, values.odometerKm, id);
    }
    const provider = values.providerName
      ? await this.providerNamed(tx, vehicle.userId, values.providerName)
      : null;
    const total = serviceRecordTotal(values);
    const data = {
      type: values.type,
      title: values.title,
      categoryKey: values.categoryKey,
      serviceDate: toDbDate(values.serviceDate)!,
      odometerKm: values.odometerKm ?? null,
      providerId: provider?.id ?? null,
      technician: values.technician ?? null,
      description: values.description ?? null,
      labourAmount: values.labourAmount ?? null,
      partsAmount: values.partsAmount ?? null,
      otherAmount: values.otherAmount ?? null,
      taxAmount: values.taxAmount ?? null,
      discountAmount: values.discountAmount ?? null,
      totalAmount: total,
      paymentMethod: values.paymentMethod ?? null,
      warrantyUntil: toDbDate(values.warrantyUntil),
      warrantyNotes: values.warrantyNotes ?? null,
      notes: values.notes ?? null,
    };
    const itemRows = items.map((item, position) => ({
      position,
      name: item.name,
      partNumber: item.partNumber ?? null,
      scheduleId: item.scheduleId ?? null,
      componentId: item.componentId ?? null,
    }));
    if (current) {
      await tx.serviceRecordItem.deleteMany({ where: { recordId: id } });
      await tx.serviceRecord.update({
        where: { id },
        data: { ...data, items: { create: itemRows } },
      });
    } else {
      await tx.serviceRecord.create({
        data: {
          ...data,
          id,
          userId: vehicle.userId,
          vehicleId: vehicle.id,
          items: { create: itemRows },
        },
      });
    }

    // One expense per record while it cost something; ₹0 records keep none.
    if (new Prisma.Decimal(total).greaterThan(0)) {
      await this.linked.sync(
        tx,
        toMaintenanceExpense(
          { ...values, id, userId: vehicle.userId, vehicleId: vehicle.id },
          total,
          provider?.name ?? null,
        ),
      );
    } else if (current) {
      await this.linked.remove(tx, "MAINTENANCE", id);
    }

    if (values.odometerKm != null)
      await this.vehicles.raiseOdometer(vehicle.id, values.odometerKm, tx);
    const was = current?.odometerKm;
    if (was != null && (values.odometerKm ?? 0) < was) {
      // A corrected typo (84120 → 8412) mustn't leave the vehicle at the wrong reading.
      const [records, expenses] = await Promise.all([
        tx.serviceRecord.aggregate({
          where: { vehicleId: vehicle.id },
          _max: { odometerKm: true },
        }),
        this.linked.highestOdometer(tx, vehicle.id),
      ]);
      const highest = Math.max(records._max.odometerKm ?? 0, expenses ?? 0);
      await this.vehicles.correctOdometer(vehicle.id, was, highest, tx);
    }
  }

  /**
   * Items may complete only this vehicle's schedules, once per day each; a schedule due by
   * distance needs the reading, or its countdown couldn't restart.
   */
  private async assertSchedules(
    tx: Prisma.TransactionClient,
    vehicle: Vehicle,
    recordId: string,
    values: CreateServiceRecordValues,
  ) {
    const items = values.items ?? [];
    const componentIds = items.flatMap((item) => (item.componentId ? [item.componentId] : []));
    if (componentIds.length) {
      const found = await tx.vehicleComponent.findMany({
        where: { id: { in: componentIds }, userId: vehicle.userId, vehicleId: vehicle.id },
        select: { id: true },
      });
      const missing = items.findIndex(
        (item) => item.componentId && !found.some((row) => row.id === item.componentId),
      );
      if (missing >= 0) {
        throw new BadRequestException(
          fieldError(`items.${missing}.componentId`, "Choose a component of this vehicle"),
        );
      }
    }
    const ids = items.flatMap((item) => (item.scheduleId ? [item.scheduleId] : []));
    if (!ids.length) return;
    const schedules = await tx.maintenanceSchedule.findMany({
      where: { id: { in: ids }, userId: vehicle.userId, vehicleId: vehicle.id },
      select: { id: true, name: true, intervalKm: true, dueKm: true },
    });
    const indexOf = (scheduleId: string) =>
      items.findIndex((item) => item.scheduleId === scheduleId);
    for (const scheduleId of ids) {
      if (!schedules.some((schedule) => schedule.id === scheduleId)) {
        throw new BadRequestException(
          fieldError(
            `items.${indexOf(scheduleId)}.scheduleId`,
            "Choose a schedule of this vehicle",
          ),
        );
      }
    }
    const byDistance = schedules.find(
      (schedule) => schedule.intervalKm != null || schedule.dueKm != null,
    );
    if (byDistance && values.odometerKm == null) {
      throw new BadRequestException(
        fieldError(
          "odometerKm",
          `Add the odometer reading: this completes ${byDistance.name}, which is due by distance`,
        ),
      );
    }
    const twin = await tx.serviceRecordItem.findFirst({
      where: {
        scheduleId: { in: ids },
        recordId: { not: recordId },
        record: { serviceDate: toDbDate(values.serviceDate)! },
      },
      select: { scheduleId: true, record: { select: { title: true } } },
    });
    if (twin) {
      const name = schedules.find((schedule) => schedule.id === twin.scheduleId)?.name;
      throw new ConflictException(
        fieldError(
          `items.${indexOf(twin.scheduleId!)}.scheduleId`,
          `${name} was already completed that day by "${twin.record.title}"`,
        ),
      );
    }
  }

  /**
   * One odometer history per vehicle: Expenses' readings (fill-ups included) and service records
   * (₹0 ones have no expense). A reading can't be below one from an earlier day or above one from
   * a later day; same-day readings aren't ordered.
   */
  private async assertOdometerInOrder(
    tx: Prisma.TransactionClient,
    vehicleId: string,
    serviceDate: string,
    odometerKm: number,
    recordId: string,
  ) {
    const date = toDbDate(serviceDate)!;
    const others = { vehicleId, odometerKm: { not: null }, id: { not: recordId } };
    const select = { odometerKm: true, serviceDate: true } as const;
    const [expenses, recordBefore, recordAfter] = await Promise.all([
      this.linked.odometerAround(tx, vehicleId, date, {
        source: "MAINTENANCE",
        sourceId: recordId,
      }),
      tx.serviceRecord.findFirst({
        where: { ...others, serviceDate: { lt: date } },
        orderBy: { odometerKm: "desc" },
        select,
      }),
      tx.serviceRecord.findFirst({
        where: { ...others, serviceDate: { gt: date } },
        orderBy: { odometerKm: "asc" },
        select,
      }),
    ]);
    const reading = (row: typeof recordBefore): Reading | null =>
      row && { km: row.odometerKm!, date: row.serviceDate };
    const before = [expenses.before, reading(recordBefore)]
      .filter((item): item is Reading => !!item)
      .sort((a, b) => b.km - a.km)[0];
    const after = [expenses.after, reading(recordAfter)]
      .filter((item): item is Reading => !!item)
      .sort((a, b) => a.km - b.km)[0];
    const clash =
      before && odometerKm < before.km
        ? `Lower than ${km.format(before.km)} km, recorded on ${day.format(before.date)}. Check the reading or the date.`
        : after && odometerKm > after.km
          ? `Higher than ${km.format(after.km)} km, recorded later on ${day.format(after.date)}. Check the reading or the date.`
          : null;
    if (clash) {
      throw new ConflictException({
        message: "This odometer reading is out of order with your other records.",
        details: [{ field: "odometerKm", message: clash }],
      });
    }
  }

  /** The user's workshop with this name (any case), created on first use. */
  async providerNamed(tx: Prisma.TransactionClient, userId: string, name: string) {
    const existing = await tx.serviceProvider.findFirst({
      where: { userId, name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    return (
      existing ??
      tx.serviceProvider.create({ data: { userId, name }, select: { id: true, name: true } })
    );
  }

  private async locked(
    tx: Prisma.TransactionClient,
    userId: string,
    vehicleId: string,
    id: string,
  ) {
    const vehicle = await this.vehicles.lockOwned(userId, vehicleId, tx);
    assertActive(vehicle);
    const row = await tx.serviceRecord.findFirst({
      where: { id, userId, vehicleId },
      include: RECORD_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return { vehicle, row };
  }

  private async present(rows: RecordRow[]): Promise<ServiceRecord[]> {
    const expenses = await this.linked.expenseIdsFor(
      this.prisma,
      "MAINTENANCE",
      rows.map((row) => row.id),
    );
    return rows.map((row) => toServiceRecord(row, expenses.get(row.id) ?? null));
  }
}
