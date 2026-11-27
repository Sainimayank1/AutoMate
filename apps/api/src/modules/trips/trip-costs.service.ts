import { randomUUID } from "node:crypto";

import {
  addDays,
  createTripCostSchema,
  type CreateTripCostValues,
  pageMeta,
  type PaginationQuery,
  ReportingPeriod,
  resolvePeriod,
  TRIP_COST_EXPENSE,
  type TripCost,
  type TripCostCategory,
  type TripCostListQuery,
  type TripCostsSummary,
  type TripCostSummaryQuery,
  type TripFuelEntry,
  tripLabel,
  type TripSpending,
  type UpdateTripCostValues,
} from "@automate/shared";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma, type Vehicle } from "@/generated/prisma/client";
import { LinkedExpensesService } from "@/modules/expenses/linked-expenses.service";
import { FuelService } from "@/modules/fuel/fuel.service";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import { isoDate, toDbDate } from "./trip.mapper";

const COST_LABELS: Record<TripCostCategory, string> = {
  TOLL: "Toll",
  PARKING: "Parking",
  FOOD: "Food",
  ACCOMMODATION: "Accommodation",
  OTHER: "Trip cost",
};
const COST_INCLUDE = {
  trip: {
    select: {
      id: true,
      vehicleId: true,
      title: true,
      origin: true,
      destination: true,
      date: true,
      category: { select: { name: true } },
    },
  },
} as const satisfies Prisma.TripCostInclude;
type CostRow = Prisma.TripCostGetPayload<{ include: typeof COST_INCLUDE }>;
type TripRef = CostRow["trip"];

function assertActive(vehicle: Vehicle) {
  if (vehicle.archivedAt) {
    throw new ConflictException(
      `${vehicle.make} ${vehicle.model} is archived. Restore it to change its trips.`,
    );
  }
}

/**
 * A trip's money (docs/architecture/trips.md §1): its costs (toll, parking and other also the
 * vehicle's expenses, linked in the same transaction; food and accommodation trip-only), the
 * fill-ups linked to it as its actual fuel, and the fuel estimate, never counted as spending.
 */
@Injectable()
export class TripCostsService {
  private readonly logger = new Logger(TripCostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly linked: LinkedExpensesService,
    private readonly fuel: FuelService,
  ) {}

  async list(userId: string, tripId: string, page: PaginationQuery): Promise<Paginated<TripCost>> {
    await this.ownedTrip(userId, tripId);
    return this.page({ userId, tripId }, page);
  }

  /** Costs across trips by their date (the Costs tab), newest first. */
  async across(
    userId: string,
    { vehicleId, category, period, from, to, page, pageSize }: TripCostListQuery,
  ): Promise<Paginated<TripCost>> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const window = this.window(period, from, to);
    return this.page(
      {
        userId,
        ...(category && { category }),
        ...(vehicleId && { trip: { vehicleId } }),
        date: { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! },
      },
      { page, pageSize },
    );
  }

  async create(userId: string, tripId: string, input: CreateTripCostValues): Promise<TripCost> {
    const id = await this.prisma.$transaction(async (tx) => {
      const trip = await this.lockedTrip(tx, userId, tripId);
      // A retried save (same client id) returns the cost it already made.
      if (input.id) {
        const existing = await tx.tripCost.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const row = await tx.tripCost.create({
        data: { ...columns(input), id: input.id ?? randomUUID(), userId, tripId },
        include: COST_INCLUDE,
      });
      await this.syncExpense(tx, userId, row, trip);
      return row.id;
    });
    this.logger.log(`Trip cost ${id} created`);
    return this.get(userId, id);
  }

  /** Merges and re-checks the whole cost; its expense follows (created, updated or removed). */
  async update(
    userId: string,
    tripId: string,
    id: string,
    input: UpdateTripCostValues,
  ): Promise<TripCost> {
    await this.prisma.$transaction(async (tx) => {
      const trip = await this.lockedTrip(tx, userId, tripId);
      const current = await this.ownedCost(tx, userId, tripId, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const parsed = createTripCostSchema.safeParse({ ...asInput(current), ...changes });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      const row = await tx.tripCost.update({
        where: { id },
        data: columns(parsed.data),
        include: COST_INCLUDE,
      });
      await this.syncExpense(tx, userId, row, trip);
    });
    this.logger.log(`Trip cost ${id} updated`);
    return this.get(userId, id);
  }

  async remove(userId: string, tripId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockedTrip(tx, userId, tripId);
      await this.ownedCost(tx, userId, tripId, id);
      await tx.tripCost.delete({ where: { id } });
      await this.linked.remove(tx, "TRIP", id);
    });
    this.logger.log(`Trip cost ${id} deleted`);
  }

  /** Actual money (recorded costs and linked fill-ups) apart from the fuel estimate. */
  async spending(userId: string, tripId: string): Promise<TripSpending> {
    const trip = await this.ownedTrip(userId, tripId);
    const [groups, fuel, summary] = await Promise.all([
      this.prisma.tripCost.groupBy({ by: ["category"], where: { tripId }, _sum: { amount: true } }),
      this.prisma.fuelEntry.aggregate({
        where: { tripId },
        _count: true,
        _sum: { totalAmount: true },
      }),
      this.fuel.summary(userId, trip.vehicleId),
    ]);
    const byCategory = [
      ...(fuel._count
        ? [{ category: "FUEL" as const, amount: fuel._sum.totalAmount ?? new Prisma.Decimal(0) }]
        : []),
      ...groups.map((group) => ({
        category: group.category,
        amount: group._sum.amount ?? new Prisma.Decimal(0),
      })),
    ].sort((a, b) => b.amount.comparedTo(a.amount));
    const recorded = byCategory.length > 0;
    const actual = byCategory.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    const mileage = summary.averageMileage ? new Prisma.Decimal(summary.averageMileage) : null;
    const quantity = mileage?.gt(0) ? trip.distanceKm.div(mileage) : null;
    return {
      actual: recorded ? actual.toFixed(2) : null,
      byCategory: byCategory.map((row) => ({
        category: row.category,
        amount: row.amount.toFixed(2),
      })),
      perKm: recorded && trip.distanceKm.gt(0) ? actual.div(trip.distanceKm).toFixed(2) : null,
      fuelEntries: fuel._count,
      estimate:
        quantity && mileage
          ? {
              fuelType: summary.fuelType,
              quantity: quantity.toFixed(1),
              cost: summary.averagePrice ? quantity.mul(summary.averagePrice).toFixed(2) : null,
              mileage: mileage.toFixed(1),
              price: summary.averagePrice,
            }
          : null,
    };
  }

  /** Actual trip costs in a period by their date (linked fill-ups by theirs), by category. */
  async summary(
    userId: string,
    { vehicleId, period, from, to }: TripCostSummaryQuery,
  ): Promise<TripCostsSummary> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const window = this.window(period, from, to);
    const tripScope = { userId, ...(vehicleId && { vehicleId }) };
    const costWhere: Prisma.TripCostWhereInput = {
      userId,
      ...(vehicleId && { trip: { vehicleId } }),
      date: { gte: toDbDate(window.from)!, lte: toDbDate(window.to)! },
    };
    // Fill-ups are timestamps; the window is India's calendar days.
    const fuelWhere: Prisma.FuelEntryWhereInput = {
      trip: tripScope,
      filledAt: {
        gte: new Date(`${window.from}T00:00:00+05:30`),
        lt: new Date(`${addDays(window.to, 1)}T00:00:00+05:30`),
      },
    };
    const [groups, fuel, costTrips, fuelTrips] = await Promise.all([
      this.prisma.tripCost.groupBy({ by: ["category"], where: costWhere, _sum: { amount: true } }),
      this.prisma.fuelEntry.aggregate({ where: fuelWhere, _sum: { totalAmount: true } }),
      this.prisma.tripCost.findMany({
        where: costWhere,
        select: { tripId: true },
        distinct: ["tripId"],
      }),
      this.prisma.fuelEntry.findMany({
        where: fuelWhere,
        select: { tripId: true },
        distinct: ["tripId"],
      }),
    ]);
    const byCategory = [
      ...(fuel._sum.totalAmount
        ? [{ category: "FUEL" as const, amount: fuel._sum.totalAmount }]
        : []),
      ...groups.map((group) => ({
        category: group.category,
        amount: group._sum.amount ?? new Prisma.Decimal(0),
      })),
    ].sort((a, b) => b.amount.comparedTo(a.amount));
    const total = byCategory.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
    const tripIds = [...new Set([...costTrips, ...fuelTrips].map((row) => row.tripId!))];
    const distance = tripIds.length
      ? ((
          await this.prisma.trip.aggregate({
            where: { id: { in: tripIds } },
            _sum: { distanceKm: true },
          })
        )._sum.distanceKm ?? new Prisma.Decimal(0))
      : new Prisma.Decimal(0);
    return {
      period: window,
      vehicleId: vehicleId ?? null,
      total: total.toFixed(2),
      byCategory: byCategory.map((row) => ({
        category: row.category,
        amount: row.amount.toFixed(2),
      })),
      perKm: total.gt(0) && distance.gt(0) ? total.div(distance).toFixed(2) : null,
    };
  }

  // ---- fill-ups linked to a trip

  async fuelEntries(
    userId: string,
    tripId: string,
    page: PaginationQuery,
  ): Promise<Paginated<TripFuelEntry>> {
    await this.ownedTrip(userId, tripId);
    return this.fuelPage({ tripId }, page);
  }

  /** The vehicle's fill-ups from the day before the trip to the day after, not on another trip. */
  async fuelCandidates(
    userId: string,
    tripId: string,
    page: PaginationQuery,
  ): Promise<Paginated<TripFuelEntry>> {
    const trip = await this.ownedTrip(userId, tripId);
    const from = addDays(isoDate(trip.date), -1);
    const to = addDays(isoDate(trip.endDate ?? trip.date), 2);
    return this.fuelPage(
      {
        vehicleId: trip.vehicleId,
        OR: [{ tripId: null }, { tripId }],
        filledAt: {
          gte: new Date(`${from}T00:00:00+05:30`),
          lt: new Date(`${to}T00:00:00+05:30`),
        },
      },
      page,
    );
  }

  /** A fill-up of the same vehicle becomes this trip's actual fuel (once; Fuel still owns it). */
  async linkFuel(userId: string, tripId: string, fuelEntryId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const trip = await this.lockedTrip(tx, userId, tripId);
      const entry = await tx.fuelEntry.findFirst({
        where: { id: fuelEntryId, userId, vehicleId: trip.vehicleId },
        select: { tripId: true },
      });
      if (!entry) throw new NotFoundException("Fill-up not found for this trip's vehicle");
      if (entry.tripId && entry.tripId !== tripId) {
        throw new ConflictException("This fill-up is already linked to another trip");
      }
      await tx.fuelEntry.update({ where: { id: fuelEntryId }, data: { tripId } });
    });
  }

  async unlinkFuel(userId: string, tripId: string, fuelEntryId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockedTrip(tx, userId, tripId);
      const { count } = await tx.fuelEntry.updateMany({
        where: { id: fuelEntryId, userId, tripId },
        data: { tripId: null },
      });
      if (!count) throw new NotFoundException("That fill-up isn't linked to this trip");
    });
  }

  // ---- helpers

  /** One cost (its expense's "Edit in Trips" link opens its trip through this). */
  async get(userId: string, id: string): Promise<TripCost> {
    const row = await this.prisma.tripCost.findFirst({
      where: { id, userId },
      include: COST_INCLUDE,
    });
    if (!row) throw new NotFoundException("Trip cost not found");
    const expenses = await this.linked.expenseIdsFor(this.prisma, "TRIP", [row.id]);
    return toTripCost(row, expenses.get(row.id) ?? null);
  }

  private async page(where: Prisma.TripCostWhereInput, page: PaginationQuery) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tripCost.findMany({
        where,
        include: COST_INCLUDE,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(page),
      }),
      this.prisma.tripCost.count({ where }),
    ]);
    const expenses = await this.linked.expenseIdsFor(
      this.prisma,
      "TRIP",
      rows.map((row) => row.id),
    );
    return new Paginated(
      rows.map((row) => toTripCost(row, expenses.get(row.id) ?? null)),
      pageMeta(page, total),
    );
  }

  private async fuelPage(where: Prisma.FuelEntryWhereInput, page: PaginationQuery) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fuelEntry.findMany({
        where,
        orderBy: [{ filledAt: "desc" }, { id: "desc" }],
        select: { id: true, filledAt: true, stationName: true, quantity: true, totalAmount: true },
        ...pageArgs(page),
      }),
      this.prisma.fuelEntry.count({ where }),
    ]);
    return new Paginated<TripFuelEntry>(
      rows.map((row) => ({
        id: row.id,
        filledAt: row.filledAt.toISOString(),
        station: row.stationName,
        quantity: row.quantity.toFixed(2),
        totalAmount: row.totalAmount.toFixed(2),
      })),
      pageMeta(page, total),
    );
  }

  /** Toll, parking and other keep one linked expense; food and accommodation have none. */
  private async syncExpense(
    tx: Prisma.TransactionClient,
    userId: string,
    row: CostRow,
    trip: TripRef,
  ) {
    const mapping = TRIP_COST_EXPENSE[row.category];
    if (!mapping) return this.linked.remove(tx, "TRIP", row.id);
    const label = tripLabel(trip);
    await this.linked.sync(tx, {
      userId,
      vehicleId: trip.vehicleId,
      source: "TRIP",
      sourceId: row.id,
      categoryKey: mapping.categoryKey,
      subcategoryKey: mapping.subcategoryKey,
      title: `${COST_LABELS[row.category]} · ${label}`.slice(0, 120),
      amount: row.amount.toFixed(2),
      date: isoDate(row.date),
      paymentMethod: row.paymentMethod,
      vendor: row.vendor,
      odometerKm: null,
      description: `Trip on ${isoDate(trip.date)}: ${label}`.slice(0, 500),
      notes: row.notes,
    });
  }

  private window(period: ReportingPeriod, from?: string, to?: string) {
    const custom = period === ReportingPeriod.CUSTOM ? { from: from!, to: to! } : undefined;
    return resolvePeriod(period, new Date(), custom);
  }

  private async ownedTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } });
    if (!trip) throw new NotFoundException("Trip not found");
    return trip;
  }

  /** The trip under its vehicle's lock; archived vehicles' trips are read-only. */
  private async lockedTrip(tx: Prisma.TransactionClient, userId: string, tripId: string) {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, userId },
      select: COST_INCLUDE.trip.select,
    });
    if (!trip) throw new NotFoundException("Trip not found");
    assertActive(await this.vehicles.lockOwned(userId, trip.vehicleId, tx));
    return trip;
  }

  private async ownedCost(
    tx: Prisma.TransactionClient,
    userId: string,
    tripId: string,
    id: string,
  ) {
    const row = await tx.tripCost.findFirst({ where: { id, userId, tripId } });
    if (!row) throw new NotFoundException("Trip cost not found");
    return row;
  }
}

const columns = (values: CreateTripCostValues) => ({
  category: values.category,
  amount: new Prisma.Decimal(values.amount),
  date: toDbDate(values.date)!,
  vendor: values.vendor ?? null,
  paymentMethod: values.paymentMethod ?? null,
  notes: values.notes ?? null,
});

function asInput(row: {
  category: TripCostCategory;
  amount: Prisma.Decimal;
  date: Date;
  vendor: string | null;
  paymentMethod: CreateTripCostValues["paymentMethod"];
  notes: string | null;
}): CreateTripCostValues {
  return {
    category: row.category,
    amount: row.amount.toFixed(2),
    date: isoDate(row.date),
    vendor: row.vendor,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
  };
}

function toTripCost(row: CostRow, expenseId: string | null): TripCost {
  return {
    id: row.id,
    tripId: row.tripId,
    vehicleId: row.trip.vehicleId,
    category: row.category,
    amount: row.amount.toFixed(2),
    date: isoDate(row.date),
    vendor: row.vendor,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    expenseId,
    trip: { id: row.trip.id, label: tripLabel(row.trip), date: isoDate(row.trip.date) },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
