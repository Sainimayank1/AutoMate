import { randomUUID } from "node:crypto";

import {
  addDays,
  type CompleteTripPlanValues,
  createTripPlanSchema,
  type CreateTripPlanValues,
  createTripSchema,
  istToday,
  pageMeta,
  planBudget,
  type SystemTripCategoryKey,
  type Trip,
  tripDays,
  tripLabel,
  type TripPlan,
  type TripPlanListQuery,
  type TripReminder,
  type UpdateTripPlanValues,
} from "@automate/shared";
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";

import {
  asTripInput,
  isoDate,
  planEstimates,
  toDbDate,
  TRIP_INCLUDE,
  type TripRow,
} from "./trip.mapper";
import {
  assertActive,
  columns,
  decimal,
  keepsRoute,
  type StoredRoute,
  storedRoute,
  TripsService,
} from "./trips.service";

const NOT_FOUND = "Planned trip not found";
const OPEN = ["DRAFT", "PLANNED", "CANCELLED"] as const;
const money = (value: string | null | undefined) =>
  value == null ? null : new Prisma.Decimal(value);

/**
 * Planned trips (docs/architecture/trips.md §1): drafts and plans with places, a planned distance
 * (entered or from the provider's route) and a budget from assumptions; cancelled or completed.
 * Completing turns the same row into a done trip and keeps the plan's figures beside the actual
 * ones. Plans never count in distance, costs, the odometer or the dashboard.
 */
@Injectable()
export class TripPlansService {
  private readonly logger = new Logger(TripPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly trips: TripsService,
  ) {}

  async list(userId: string, { vehicleId, view, page, pageSize }: TripPlanListQuery) {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const upcoming = view === "upcoming";
    const where: Prisma.TripWhereInput = {
      userId,
      ...(vehicleId && { vehicleId }),
      status: upcoming ? { in: ["DRAFT", "PLANNED"] } : "CANCELLED",
    };
    const sort = upcoming ? "asc" : "desc";
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE,
        orderBy: [
          { date: sort },
          { startTime: { sort, nulls: "last" } },
          { createdAt: sort },
          { id: sort },
        ],
        ...pageArgs({ page, pageSize }),
      }),
      this.prisma.trip.count({ where }),
    ]);
    return new Paginated<TripPlan>(rows.map(toPlan), pageMeta({ page, pageSize }, total));
  }

  async get(userId: string, id: string): Promise<TripPlan> {
    return toPlan(await this.owned(userId, id));
  }

  async create(userId: string, input: CreateTripPlanValues): Promise<TripPlan> {
    // The route provider is called before the transaction (it can be slow).
    const route = input.method === "ROUTE" ? await this.trips.routeFor(input) : null;
    const id = await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.vehicles.lockOwned(userId, input.vehicleId, tx);
      assertActive(vehicle);
      if (input.id) {
        const existing = await tx.trip.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      const id = input.id ?? randomUUID();
      await this.trips.assertCategory(tx, userId, input.categoryId);
      await tx.trip.create({
        data: { ...planColumns(input, route), id, userId, vehicleId: vehicle.id },
      });
      await this.trips.writeStops(tx, id, input.stops ?? []);
      return id;
    });
    this.logger.log(`Trip plan ${id} created`);
    return this.get(userId, id);
  }

  /** Merges and re-checks the whole plan; changed places on a route plan get a fresh route. */
  async update(userId: string, id: string, input: UpdateTripPlanValues): Promise<TripPlan> {
    const before = await this.owned(userId, id);
    const values = mergedPlan(before, input);
    const route =
      values.method !== "ROUTE"
        ? null
        : keepsRoute(before, values, input.routeIndex)
          ? storedRoute(before)
          : await this.trips.routeFor(values);
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, id, before.updatedAt);
      if (values.categoryId !== before.categoryId) {
        await this.trips.assertCategory(tx, userId, values.categoryId);
      }
      await tx.trip.update({ where: { id }, data: planColumns(values, route) });
      if (input.stops !== undefined) await this.trips.writeStops(tx, id, values.stops ?? []);
    });
    this.logger.log(`Trip plan ${id} updated`);
    return this.get(userId, id);
  }

  /** Cancelled plans stay in the planner's "Cancelled" list; restoring makes them plans again. */
  async setCancelled(userId: string, id: string, cancelled: boolean): Promise<TripPlan> {
    const before = await this.owned(userId, id);
    const status = cancelled ? "CANCELLED" : "PLANNED";
    if (before.status !== status) {
      await this.prisma.$transaction(async (tx) => {
        await this.locked(tx, userId, id, before.updatedAt);
        await tx.trip.update({ where: { id }, data: { status } });
      });
      this.logger.log(`Trip plan ${id} ${cancelled ? "cancelled" : "restored"}`);
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const before = await this.owned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.locked(tx, userId, id, before.updatedAt);
      await tx.trip.delete({ where: { id } });
    });
    this.logger.log(`Trip plan ${id} deleted`);
  }

  /**
   * The plan happened: the same row becomes a done trip with what actually happened (readings,
   * entered distance, or the plan's route), checked like any trip; the plan's figures stay.
   */
  async complete(userId: string, id: string, input: CompleteTripPlanValues): Promise<Trip> {
    const before = await this.owned(userId, id);
    // When and how far it actually went come only from the input, never the plan's guesses.
    const parsed = createTripSchema.safeParse({
      ...asTripInput(before),
      endDate: null,
      startTime: null,
      endTime: null,
      ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
    });
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    const values = parsed.data;
    const route =
      values.method !== "ROUTE"
        ? null
        : before.method === "ROUTE" && input.routeIndex === undefined
          ? storedRoute(before)
          : await this.trips.routeFor(values);
    await this.prisma.$transaction(async (tx) => {
      const vehicle = await this.locked(tx, userId, id, before.updatedAt);
      await this.trips.assertReadings(tx, vehicle, id, values);
      await tx.trip.update({
        where: { id },
        data: { ...columns(values, route), status: "COMPLETED" },
      });
      if (values.endKm != null) await this.vehicles.raiseOdometer(vehicle.id, values.endKm, tx);
    });
    this.logger.log(`Trip plan ${id} completed`);
    return this.trips.get(userId, id);
  }

  /**
   * The integration point for Notifications (M10), which will call it: plans leaving within
   * `horizonDays`, plans whose last day has passed without being marked done, and planned or
   * multi-day trips that ended in the last 7 days with no costs or fill-ups recorded. Archived
   * vehicles are left out. Soonest departures first, then the rest by date.
   */
  async reminders(
    userId: string,
    { vehicleId, horizonDays = 7 }: { vehicleId?: string; horizonDays?: number },
    now = new Date(),
  ): Promise<TripReminder[]> {
    const today = istToday(now);
    const day = (date: string) => toDbDate(date)!;
    const scope: Prisma.TripWhereInput = {
      userId,
      ...(vehicleId && { vehicleId }),
      vehicle: { archivedAt: null },
    };
    const open = { in: ["DRAFT" as const, "PLANNED" as const] };
    const select = {
      id: true,
      vehicleId: true,
      date: true,
      endDate: true,
      title: true,
      origin: true,
      destination: true,
      category: { select: { name: true } },
    } as const;
    const [leaving, passed, uncosted] = await Promise.all([
      this.prisma.trip.findMany({
        where: {
          ...scope,
          status: open,
          date: { gte: day(today), lte: day(addDays(today, horizonDays)) },
        },
        select,
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
      this.prisma.trip.findMany({
        where: {
          ...scope,
          status: open,
          OR: [{ endDate: { lt: day(today) } }, { endDate: null, date: { lt: day(today) } }],
        },
        select,
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
      this.prisma.trip.findMany({
        where: {
          ...scope,
          status: "COMPLETED",
          costs: { none: {} },
          fuelEntries: { none: {} },
          // Multi-day (an end date is only stored when it differs) or planned.
          AND: [
            {
              OR: [
                { endDate: { gte: day(addDays(today, -7)), lte: day(today) } },
                { endDate: null, date: { gte: day(addDays(today, -7)), lte: day(today) } },
              ],
            },
            { OR: [{ endDate: { not: null } }, { plannedDistanceKm: { not: null } }] },
          ],
        },
        select,
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
    ]);
    const lastDay = (row: (typeof leaving)[number]) => isoDate(row.endDate ?? row.date);
    const reminder = (
      kind: TripReminder["kind"],
      row: (typeof leaving)[number],
      date: string,
      days: number,
      link: string,
    ): TripReminder => ({
      kind,
      tripId: row.id,
      vehicleId: row.vehicleId,
      label: tripLabel(row),
      date,
      days,
      link,
    });
    return [
      ...leaving.map((row) =>
        reminder(
          "departure",
          row,
          isoDate(row.date),
          tripDays(today, isoDate(row.date)) - 1,
          `/trips/planner/${row.id}`,
        ),
      ),
      ...passed.map((row) =>
        reminder(
          "unconfirmed",
          row,
          lastDay(row),
          tripDays(lastDay(row), today) - 1,
          `/trips/planner/${row.id}`,
        ),
      ),
      ...uncosted.map((row) =>
        reminder(
          "add_costs",
          row,
          lastDay(row),
          tripDays(lastDay(row), today) - 1,
          `/trips/${row.id}`,
        ),
      ),
    ];
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.trip.findFirst({
      where: { id, userId, status: { in: [...OPEN] } },
      include: TRIP_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /** Under the vehicle's lock, unchanged since it was read (else 409); archived = read-only. */
  private async locked(tx: Prisma.TransactionClient, userId: string, id: string, seen: Date) {
    const row = await tx.trip.findFirst({
      where: { id, userId, status: { in: [...OPEN] } },
      select: { vehicleId: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    const vehicle = await this.vehicles.lockOwned(userId, row.vehicleId, tx);
    assertActive(vehicle);
    if (row.updatedAt.getTime() !== seen.getTime()) {
      throw new ConflictException("This plan changed while you were saving. Try again.");
    }
    return vehicle;
  }
}

/** What a plan writes: no readings or actual distance; the planned distance is the route's. */
export function planColumns(values: CreateTripPlanValues, route: StoredRoute | null) {
  return {
    method: values.method ?? "DISTANCE",
    status: values.status ?? "PLANNED",
    categoryId: values.categoryId,
    title: values.title ?? null,
    date: toDbDate(values.date)!,
    endDate: values.endDate && values.endDate !== values.date ? toDbDate(values.endDate) : null,
    startTime: values.startTime ?? null,
    endTime: null,
    startKm: null,
    endKm: null,
    distanceKm: null,
    plannedDistanceKm: route
      ? new Prisma.Decimal(route.distanceKm)
      : money(values.plannedDistanceKm),
    plannedDurationMinutes: route ? route.durationMinutes : (values.plannedDurationMinutes ?? null),
    estMileage: money(values.estMileage),
    estFuelPrice: money(values.estFuelPrice),
    estToll: money(values.estToll),
    estParking: money(values.estParking),
    estAccommodation: money(values.estAccommodation),
    estOther: money(values.estOther),
    origin: values.origin ?? null,
    destination: values.destination ?? null,
    originLat: decimal(values.originLat),
    originLng: decimal(values.originLng),
    destinationLat: decimal(values.destinationLat),
    destinationLng: decimal(values.destinationLng),
    routeProvider: route?.provider ?? null,
    routeGeometry: route?.geometry ?? null,
    routeDurationMinutes: route?.durationMinutes ?? null,
    notes: values.notes ?? null,
  };
}

/** A stored plan with a PATCH on top, checked whole. */
function mergedPlan(row: TripRow, input: UpdateTripPlanValues): CreateTripPlanValues {
  const changes = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
  const trip = asTripInput(row);
  const parsed = createTripPlanSchema.safeParse({
    ...trip,
    ...planEstimates(row),
    status: row.status === "CANCELLED" ? undefined : row.status,
    method: row.method === "ROUTE" ? "ROUTE" : "DISTANCE",
    plannedDurationMinutes: row.plannedDurationMinutes,
    endTime: undefined,
    startKm: undefined,
    endKm: undefined,
    distanceKm: undefined,
    ...changes,
  });
  if (!parsed.success) throw new ZodValidationException(parsed.error);
  return parsed.data;
}

function toPlan(row: TripRow): TripPlan {
  const estimates = planEstimates(row);
  const point = (lat: Prisma.Decimal | null, lng: Prisma.Decimal | null) =>
    lat && lng ? { latitude: lat.toNumber(), longitude: lng.toNumber() } : null;
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    status: row.status,
    category: { ...row.category, key: row.category.key as SystemTripCategoryKey | null },
    title: row.title,
    date: isoDate(row.date),
    endDate: row.endDate ? isoDate(row.endDate) : null,
    startTime: row.startTime,
    method: row.method === "ROUTE" ? "ROUTE" : "DISTANCE",
    plannedDistanceKm: estimates.plannedDistanceKm,
    plannedDurationMinutes: row.plannedDurationMinutes,
    origin: row.origin,
    destination: row.destination,
    originPoint: point(row.originLat, row.originLng),
    destinationPoint: point(row.destinationLat, row.destinationLng),
    stops: row.stops.map((stop) => ({
      id: stop.id,
      label: stop.label,
      latitude: stop.latitude?.toNumber() ?? null,
      longitude: stop.longitude?.toNumber() ?? null,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      notes: stop.notes,
      day: stop.day,
      overnight: stop.overnight,
    })),
    route:
      row.routeProvider && row.routeGeometry
        ? {
            provider: row.routeProvider,
            distanceKm: estimates.plannedDistanceKm ?? "0.0",
            durationMinutes: row.routeDurationMinutes ?? 0,
            geometry: row.routeGeometry,
          }
        : null,
    estMileage: estimates.estMileage,
    estFuelPrice: estimates.estFuelPrice,
    estToll: estimates.estToll,
    estParking: estimates.estParking,
    estAccommodation: estimates.estAccommodation,
    estOther: estimates.estOther,
    budget: planBudget(estimates),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
