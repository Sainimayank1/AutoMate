import { randomUUID } from "node:crypto";

import {
  createTripSchema,
  type CreateTripValues,
  type DateWindow,
  type DrivingTrips,
  pageMeta,
  type PaginationQuery,
  ReportingPeriod,
  resolvePeriod,
  SYSTEM_TRIP_CATEGORIES,
  type SystemTripCategoryKey,
  type Trip,
  type TripBulkValues,
  type TripCategory,
  type TripCategoryValues,
  tripDistance,
  type TripFilters,
  tripLabel,
  type TripListQuery,
  type TripOverview,
  type TripOverviewQuery,
  type TripSort,
  type TripSummary,
  type UpdateTripValues,
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
import { LinkedExpensesService } from "@/modules/expenses/linked-expenses.service";
import { OdometerHistoryService } from "@/modules/vehicles/odometer-history.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { asTripInput, isoDate, toDbDate, toTrip, TRIP_INCLUDE, type TripRow } from "./trip.mapper";
import { bucketStart, bucketStarts, chooseGranularity, tripsPerWeek } from "./trip-overview";

const NOT_FOUND = "Trip not found";
const km = new Intl.NumberFormat("en-IN");
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" });
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });
const ORDER: Prisma.TripOrderByWithRelationInput[] = [
  { date: "desc" },
  { startTime: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
  { id: "desc" },
];
const SORTS: Record<TripSort, Prisma.TripOrderByWithRelationInput[]> = {
  newest: ORDER,
  oldest: [
    { date: "asc" },
    { startTime: { sort: "asc", nulls: "first" } },
    { createdAt: "asc" },
    { id: "asc" },
  ],
  longest: [{ distanceKm: "desc" }, ...ORDER],
  shortest: [{ distanceKm: "asc" }, ...ORDER],
};

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its trips.`,
    );
  }
}

/**
 * Journeys (docs/architecture/trips.md): distance from two odometer readings or entered, checked
 * against the vehicle's one odometer history; trip types (the system's and the user's own); the
 * overview, aggregated in the database for any period.
 */
@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly odometer: OdometerHistoryService,
    private readonly linked: LinkedExpensesService,
  ) {}

  /** The history: filtered and sorted on the server, then paged. */
  async list(userId: string, { sort, page, pageSize, ...filters }: TripListQuery) {
    const where = await this.tripWhere(userId, filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE,
        orderBy: SORTS[sort],
        ...pageArgs({ page, pageSize }),
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new Paginated<Trip>(await this.withCosts(rows), pageMeta({ page, pageSize }, total));
  }

  /** How many trips match the filters and how far they went (every page). */
  async summary(userId: string, filters: TripFilters): Promise<TripSummary> {
    const { _count, _sum } = await this.prisma.trip.aggregate({
      where: await this.tripWhere(userId, filters),
      _count: true,
      _sum: { distanceKm: true },
    });
    return { trips: _count, distanceKm: (_sum.distanceKm ?? new Prisma.Decimal(0)).toFixed(1) };
  }

  /**
   * Deletes trips or moves them to another type, all or none, under their vehicles' locks.
   * Deleting corrects each vehicle's odometer down to the highest reading left.
   */
  async bulk(userId: string, input: TripBulkValues): Promise<{ count: number }> {
    const ids = [...new Set(input.ids)];
    const count = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.trip.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, vehicleId: true, endKm: true },
      });
      if (rows.length !== ids.length)
        throw new NotFoundException("Some of those trips weren't found");
      const vehicleIds = [...new Set(rows.map((row) => row.vehicleId))].sort();
      for (const vehicleId of vehicleIds) {
        assertActive(await this.vehicles.lockOwned(userId, vehicleId, tx));
      }
      if (input.action === "category") {
        const categoryId = input.categoryId!; // required for this action (tripBulkSchema)
        await this.assertCategory(tx, userId, categoryId);
        await tx.trip.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
        return ids.length;
      }
      await this.removeCostExpenses(tx, ids);
      await tx.trip.deleteMany({ where: { id: { in: ids } } });
      for (const vehicleId of vehicleIds) {
        const ends = rows.filter((row) => row.vehicleId === vehicleId && row.endKm != null);
        const highest = Math.max(...ends.map((row) => row.endKm!));
        if (ends.length) await this.vehicles.correctOdometer(vehicleId, highest, 0, tx);
      }
      return ids.length;
    });
    this.logger.log(`Bulk ${input.action} of ${count} trips`);
    return { count };
  }

  async get(userId: string, id: string): Promise<Trip> {
    const row = await this.prisma.trip.findFirst({
      where: { id, userId },
      include: TRIP_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return (await this.withCosts([row]))[0]!;
  }

  async create(userId: string, input: CreateTripValues): Promise<Trip> {
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, input.vehicleId, tx);
      assertActive(vehicle);
      // A retried save (same client id) returns the trip it already made.
      if (input.id) {
        const existing = await tx.trip.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const id = input.id ?? randomUUID();
      await this.assertCategory(tx, userId, input.categoryId);
      await this.assertReadings(tx, vehicle, id, input);
      await tx.trip.create({ data: { ...columns(input), id, userId, vehicleId: vehicle.id } });
      if (input.endKm != null) await this.vehicles.raiseOdometer(vehicle.id, input.endKm, tx);
      return id;
    });
    this.logger.log(`Trip ${id} created`);
    return this.get(userId, id);
  }

  /** Merges and re-checks the whole trip; a lowered reading corrects the vehicle down. */
  async update(userId: string, id: string, input: UpdateTripValues): Promise<Trip> {
    await this.prisma.$transaction(async (tx) => {
      const { vehicle, row } = await this.locked(tx, userId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const parsed = createTripSchema.safeParse({ ...asTripInput(row), ...changes });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const values = parsed.data;
      if (values.categoryId !== row.categoryId) {
        await this.assertCategory(tx, userId, values.categoryId);
      }
      await this.assertReadings(tx, vehicle, id, values);
      await tx.trip.update({ where: { id }, data: columns(values) });
      if (values.endKm != null) await this.vehicles.raiseOdometer(vehicle.id, values.endKm, tx);
      if (row.endKm != null && (values.endKm ?? 0) < row.endKm) {
        await this.vehicles.correctOdometer(vehicle.id, row.endKm, 0, tx);
      }
    });
    this.logger.log(`Trip ${id} updated`);
    return this.get(userId, id);
  }

  /** The vehicle's odometer stays at the highest reading left in its history. */
  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { vehicle, row } = await this.locked(tx, userId, id);
      await this.removeCostExpenses(tx, [id]);
      await tx.trip.delete({ where: { id } });
      if (row.endKm != null) await this.vehicles.correctOdometer(vehicle.id, row.endKm, 0, tx);
    });
    this.logger.log(`Trip ${id} deleted`);
  }

  /** One vehicle or all; every figure aggregated in the database (any period, any history). */
  async overview(
    userId: string,
    { vehicleId, granularity, ...query }: TripOverviewQuery,
  ): Promise<TripOverview> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const custom =
      query.period === ReportingPeriod.CUSTOM ? { from: query.from!, to: query.to! } : undefined;
    const period = resolvePeriod(query.period, new Date(), custom);
    const where: Prisma.TripWhereInput = {
      userId,
      ...(vehicleId && { vehicleId }),
      date: { gte: toDbDate(period.from)!, lte: toDbDate(period.to)! },
    };
    const vehicleSql = vehicleId ? Prisma.sql`AND vehicle_id = ${vehicleId}::uuid` : Prisma.empty;
    const [totals, longest, groups, [timed], recent] = await Promise.all([
      this.prisma.trip.aggregate({
        where,
        _count: true,
        _sum: { distanceKm: true },
        _min: { date: true },
      }),
      this.prisma.trip.findFirst({
        where,
        orderBy: [{ distanceKm: "desc" }, { date: "desc" }],
        include: TRIP_INCLUDE,
      }),
      this.prisma.trip.groupBy({
        by: ["categoryId"],
        where,
        _count: true,
        _sum: { distanceKm: true },
      }),
      this.prisma.$queryRaw<{ trips: number; minutes: number }[]>`
        SELECT count(*)::int AS trips, coalesce(sum(minutes), 0)::int AS minutes FROM (
          SELECT (coalesce(end_date, date) - date) * 1440
            + split_part(end_time, ':', 1)::int * 60 + split_part(end_time, ':', 2)::int
            - split_part(start_time, ':', 1)::int * 60 - split_part(start_time, ':', 2)::int
            AS minutes
          FROM trips
          WHERE user_id = ${userId}::uuid ${vehicleSql}
            AND date BETWEEN ${period.from}::date AND ${period.to}::date
            AND start_time IS NOT NULL AND end_time IS NOT NULL
        ) t WHERE minutes >= 0`,
      this.prisma.trip.findMany({ where, include: TRIP_INCLUDE, orderBy: ORDER, take: 5 }),
    ]);

    // All time starts at the first trip, so the chart doesn't span empty years.
    const first = totals._min.date ? isoDate(totals._min.date) : period.to;
    const shown = { from: first > period.from ? first : period.from, to: period.to };
    const unit = granularity ?? chooseGranularity(shown);
    const buckets = await this.prisma.$queryRaw<
      { start: Date; km: Prisma.Decimal; trips: number }[]
    >`
      SELECT date_trunc(${unit}, date)::date AS start, sum(distance_km) AS km, count(*)::int AS trips
      FROM trips
      WHERE user_id = ${userId}::uuid ${vehicleSql}
        AND date BETWEEN ${period.from}::date AND ${period.to}::date
      GROUP BY 1`;
    const byStart = new Map(buckets.map((row) => [isoDate(row.start), row]));

    const distance = totals._sum.distanceKm ?? new Prisma.Decimal(0);
    return {
      period,
      vehicleId: vehicleId ?? null,
      trips: totals._count,
      distanceKm: distance.toFixed(1),
      averageKm: totals._count ? distance.div(totals._count).toFixed(1) : null,
      longest: longest && {
        id: longest.id,
        distanceKm: longest.distanceKm.toFixed(1),
        label: tripLabel(longest),
      },
      drivingMinutes: timed!.trips ? timed!.minutes : null,
      timedTrips: timed!.trips,
      perWeek: totals._count ? tripsPerWeek(totals._count, shown) : null,
      byCategory: await this.byCategory(groups),
      series: {
        granularity: unit,
        points: bucketStarts(shown, unit).map((start) => {
          const row = byStart.get(bucketStart(start, unit));
          return {
            start,
            distanceKm: (row?.km ?? new Prisma.Decimal(0)).toFixed(1),
            trips: row?.trips ?? 0,
          };
        }),
      },
      cost: await this.costOf(where),
      recent: await this.withCosts(recent),
    };
  }

  /**
   * The dashboard's Driving card (dashboard.md §6): trips in the window, their own distance kept
   * apart from the odometer's. Null until the vehicle has a trip.
   */
  async dashboardTrips(
    userId: string,
    vehicleId: string,
    window: DateWindow,
  ): Promise<DrivingTrips | null> {
    const where: Prisma.TripWhereInput = {
      userId,
      vehicleId,
      date: { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! },
    };
    const [any, totals, longest, groups] = await Promise.all([
      this.prisma.trip.findFirst({ where: { userId, vehicleId }, select: { id: true } }),
      this.prisma.trip.aggregate({ where, _count: true, _sum: { distanceKm: true } }),
      this.prisma.trip.aggregate({ where, _max: { distanceKm: true } }),
      this.prisma.trip.groupBy({
        by: ["categoryId"],
        where,
        _count: true,
        _sum: { distanceKm: true },
      }),
    ]);
    if (!any) return null;
    const distance = totals._sum.distanceKm ?? new Prisma.Decimal(0);
    return {
      count: totals._count,
      distanceKm: distance.toFixed(1),
      averageKm: totals._count ? distance.div(totals._count).toFixed(1) : null,
      longestKm: longest._max.distanceKm?.toFixed(1) ?? null,
      byCategory: (await this.byCategory(groups)).map(({ key, name, distanceKm }) => ({
        key,
        name,
        distanceKm,
      })),
    };
  }

  /** The vehicle's latest trips and how many it has (the dashboard's activity feed). */
  async recent(userId: string, vehicleId: string, take: number) {
    const where = { userId, vehicleId };
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.trip.findMany({ where, include: TRIP_INCLUDE, orderBy: ORDER, take }),
      this.prisma.trip.count({ where }),
    ]);
    return { recent: await this.withCosts(rows), count };
  }

  /** Trips and km per type, most distance first. */
  private async byCategory(
    groups: { categoryId: string; _count: number; _sum: { distanceKm: Prisma.Decimal | null } }[],
  ) {
    const categories = await this.prisma.tripCategory.findMany({
      where: { id: { in: groups.map((group) => group.categoryId) } },
      select: { id: true, key: true, name: true },
    });
    return groups
      .map((group) => {
        const category = categories.find((item) => item.id === group.categoryId)!;
        return {
          categoryId: group.categoryId,
          key: category.key as SystemTripCategoryKey | null,
          name: category.name,
          trips: group._count,
          distanceKm: (group._sum.distanceKm ?? new Prisma.Decimal(0)).toFixed(1),
        };
      })
      .sort((a, b) => Number(b.distanceKm) - Number(a.distanceKm));
  }

  // ---- trip types

  /** The system types in their fixed order, then the user's own; archived ones last. */
  async categories(userId: string, page: PaginationQuery): Promise<Paginated<TripCategory>> {
    // A handful of rows per user: ordered here (the system order is a constant), then paged.
    const rows = await this.prisma.tripCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const rank = (row: (typeof rows)[number]) =>
      (row.archivedAt ? 1000 : 0) +
      (row.key ? SYSTEM_TRIP_CATEGORIES.findIndex(([key]) => key === row.key) : 100);
    return Paginated.of(
      rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index)
        .map(({ row }) => toCategory(row)),
      page,
    );
  }

  async createCategory(userId: string, { name }: TripCategoryValues): Promise<TripCategory> {
    await this.assertNameFree(userId, name);
    const row = await this.prisma.tripCategory.create({ data: { userId, name } });
    return toCategory(row);
  }

  /** Only the user's own types can be renamed or archived; the system's stay as they are. */
  async renameCategory(
    userId: string,
    id: string,
    { name }: TripCategoryValues,
  ): Promise<TripCategory> {
    await this.ownCategory(userId, id);
    await this.assertNameFree(userId, name, id);
    return toCategory(await this.prisma.tripCategory.update({ where: { id }, data: { name } }));
  }

  /** Archived types leave the picker; trips keep theirs. Idempotent. */
  async setCategoryArchived(userId: string, id: string, archived: boolean) {
    const row = await this.ownCategory(userId, id);
    if (!!row.archivedAt === archived) return toCategory(row);
    return toCategory(
      await this.prisma.tripCategory.update({
        where: { id },
        data: { archivedAt: archived ? new Date() : null },
      }),
    );
  }

  /** The filters as a query; a vehicle filter must be the user's own. */
  private async tripWhere(
    userId: string,
    {
      vehicleId,
      search,
      from,
      to,
      categoryId,
      method,
      minKm,
      maxKm,
      origin,
      destination,
    }: TripFilters,
  ): Promise<Prisma.TripWhereInput> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });
    return {
      userId,
      ...(vehicleId && { vehicleId }),
      ...(categoryId && { categoryId }),
      ...(method && { method }),
      ...((from || to) && {
        date: { ...(from && { gte: toDbDate(from)! }), ...(to && { lte: toDbDate(to)! }) },
      }),
      ...((minKm || maxKm) && {
        distanceKm: {
          ...(minKm && { gte: new Prisma.Decimal(minKm) }),
          ...(maxKm && { lte: new Prisma.Decimal(maxKm) }),
        },
      }),
      ...(origin && { origin: contains(origin) }),
      ...(destination && { destination: contains(destination) }),
      ...(search && {
        OR: [
          { title: contains(search) },
          { origin: contains(search) },
          { destination: contains(search) },
          { notes: contains(search) },
        ],
      }),
    };
  }

  // ---- money

  /** Each trip with its actual cost: recorded costs plus linked fill-ups (null when none). */
  private async withCosts(rows: TripRow[]): Promise<Trip[]> {
    const ids = rows.map((row) => row.id);
    const [costs, fuel] = await Promise.all([
      this.prisma.tripCost.groupBy({
        by: ["tripId"],
        where: { tripId: { in: ids } },
        _sum: { amount: true },
      }),
      this.prisma.fuelEntry.groupBy({
        by: ["tripId"],
        where: { tripId: { in: ids } },
        _sum: { totalAmount: true },
      }),
    ]);
    return rows.map((row) => {
      const cost = costs.find((group) => group.tripId === row.id)?._sum.amount;
      const fill = fuel.find((group) => group.tripId === row.id)?._sum.totalAmount;
      const total = cost || fill ? (cost ?? new Prisma.Decimal(0)).plus(fill ?? 0) : null;
      return toTrip(row, total?.toFixed(2) ?? null);
    });
  }

  /** The actual costs of the trips matching `where`; per km over the ones that have a cost. */
  private async costOf(where: Prisma.TripWhereInput): Promise<TripOverview["cost"]> {
    const [costs, fuel, distance] = await Promise.all([
      this.prisma.tripCost.aggregate({ where: { trip: where }, _sum: { amount: true } }),
      this.prisma.fuelEntry.aggregate({ where: { trip: where }, _sum: { totalAmount: true } }),
      this.prisma.trip.aggregate({
        where: { AND: [where, { OR: [{ costs: { some: {} } }, { fuelEntries: { some: {} } }] }] },
        _sum: { distanceKm: true },
      }),
    ]);
    if (!costs._sum.amount && !fuel._sum.totalAmount) return { total: null, perKm: null };
    const total = (costs._sum.amount ?? new Prisma.Decimal(0)).plus(fuel._sum.totalAmount ?? 0);
    const km = distance._sum.distanceKm;
    return { total: total.toFixed(2), perKm: km?.gt(0) ? total.div(km).toFixed(2) : null };
  }

  /** A deleted trip's costs take their linked expenses with them (fill-ups are only unlinked). */
  private async removeCostExpenses(tx: Prisma.TransactionClient, tripIds: string[]) {
    const costs = await tx.tripCost.findMany({
      where: { tripId: { in: tripIds } },
      select: { id: true },
    });
    for (const cost of costs) await this.linked.remove(tx, "TRIP", cost.id);
  }

  // ---- checks

  private async locked(tx: Prisma.TransactionClient, userId: string, id: string) {
    const row = await tx.trip.findFirst({ where: { id, userId }, include: TRIP_INCLUDE });
    if (!row) throw new NotFoundException(NOT_FOUND);
    const vehicle = await this.vehicles.lockOwned(userId, row.vehicleId, tx);
    assertActive(vehicle);
    return { vehicle, row };
  }

  /** A system type or the user's own, in use (not archived). */
  private async assertCategory(tx: Prisma.TransactionClient, userId: string, categoryId: string) {
    const category = await tx.tripCategory.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId }], archivedAt: null },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException(fieldError("categoryId", "Choose one of your trip types"));
    }
  }

  /**
   * Readings join the vehicle's one odometer history: the start can't be below a reading from an
   * earlier day, the end can't be above one from a later day, and no two trips cover the same km.
   */
  private async assertReadings(
    tx: Prisma.TransactionClient,
    vehicle: Vehicle,
    tripId: string,
    values: CreateTripValues,
  ) {
    if (values.method !== "ODOMETER" || values.startKm == null || values.endKm == null) return;
    const from = toDbDate(values.date)!;
    const to = toDbDate(values.endDate ?? values.date)!;
    const { before, after } = await this.odometer.around(tx, vehicle.id, { from, to }, { tripId });
    if (before && values.startKm < before.km) {
      throw new ConflictException(
        fieldError(
          "startKm",
          `Lower than ${km.format(before.km)} km, recorded on ${day.format(before.date)}. Check the reading or the date.`,
        ),
      );
    }
    if (after && values.endKm > after.km) {
      throw new ConflictException(
        fieldError(
          "endKm",
          `Higher than ${km.format(after.km)} km, recorded later on ${day.format(after.date)}. Check the reading or the date.`,
        ),
      );
    }
    const overlap = await tx.trip.findFirst({
      where: {
        vehicleId: vehicle.id,
        id: { not: tripId },
        startKm: { lt: values.endKm },
        endKm: { gt: values.startKm },
      },
      select: { date: true, startKm: true, endKm: true },
    });
    if (overlap) {
      throw new ConflictException(
        fieldError(
          "startKm",
          `Overlaps your trip on ${day.format(overlap.date)} (${km.format(overlap.startKm!)} → ${km.format(overlap.endKm!)} km).`,
        ),
      );
    }
  }

  private async ownCategory(userId: string, id: string) {
    const row = await this.prisma.tripCategory.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("Trip type not found");
    return row;
  }

  /** Unique per user ignoring case, and not a system type's name. */
  private async assertNameFree(userId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.tripCategory.findFirst({
      where: {
        OR: [{ userId: null }, { userId }],
        name: { equals: name, mode: "insensitive" },
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        fieldError("name", "You already have a trip type with this name"),
      );
    }
  }
}

/** What a create or a merged update writes; the distance is computed here, never trusted. */
function columns(values: CreateTripValues) {
  const odometer = values.method === "ODOMETER";
  return {
    method: values.method,
    categoryId: values.categoryId,
    title: values.title ?? null,
    date: toDbDate(values.date)!,
    endDate: values.endDate && values.endDate !== values.date ? toDbDate(values.endDate) : null,
    startTime: values.startTime ?? null,
    endTime: values.endTime ?? null,
    startKm: odometer ? values.startKm! : null,
    endKm: odometer ? values.endKm! : null,
    distanceKm: new Prisma.Decimal(tripDistance(values)!),
    origin: values.origin ?? null,
    destination: values.destination ?? null,
    notes: values.notes ?? null,
  };
}

function toCategory(row: {
  id: string;
  key: string | null;
  name: string;
  archivedAt: Date | null;
}): TripCategory {
  return {
    id: row.id,
    key: row.key as SystemTripCategoryKey | null,
    name: row.name,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}
