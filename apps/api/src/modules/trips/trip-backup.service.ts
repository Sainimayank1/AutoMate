import { randomUUID } from "node:crypto";

import {
  createTripCostSchema,
  createTripPlanSchema,
  createTripSchema,
  type PaymentMethod,
  type TripCostCategory,
} from "@automate/shared";
import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";
import { Prisma } from "@/generated/prisma/client";

import { isoDate } from "./trip.mapper";
import { COST_INCLUDE, costColumns, TripCostsService } from "./trip-costs.service";
import { planColumns } from "./trip-plans.service";
import { columns, type StoredRoute, TripsService } from "./trips.service";

/** Bumped when a field changes meaning; new fields are added without a bump (restore ignores none). */
export const TRIP_BACKUP_VERSION = 1;

/** One trip or plan with everything that belongs to it, in a stable JSON shape (M12 backups). */
export interface TripBackupRow {
  version: number;
  /** The id it had; restored trips get new ones. */
  id: string;
  status: "DRAFT" | "PLANNED" | "COMPLETED" | "CANCELLED";
  method: "ODOMETER" | "DISTANCE" | "ROUTE";
  /** A system type by key, else the user's own by name (created on restore when missing). */
  category: { key: string | null; name: string };
  title: string | null;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startKm: number | null;
  endKm: number | null;
  distanceKm: string | null;
  plannedDistanceKm: string | null;
  plannedDurationMinutes: number | null;
  estMileage: string | null;
  estFuelPrice: string | null;
  estToll: string | null;
  estParking: string | null;
  estAccommodation: string | null;
  estOther: string | null;
  origin: string | null;
  destination: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  route: { provider: string; geometry: string; durationMinutes: number } | null;
  notes: string | null;
  stops: {
    label: string;
    latitude: number | null;
    longitude: number | null;
    arrivalTime: string | null;
    departureTime: string | null;
    notes: string | null;
    day: number | null;
    overnight: boolean;
  }[];
  costs: {
    category: TripCostCategory;
    amount: string;
    date: string;
    vendor: string | null;
    paymentMethod: PaymentMethod | null;
    notes: string | null;
  }[];
  /** Fill-ups linked as the trip's actual fuel (their ids in the backup). */
  fuelEntryIds: string[];
}

const money = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;
const num = (value: Prisma.Decimal | null) => value?.toNumber() ?? null;

/**
 * Backup & Export (M12) reads and writes a vehicle's trips through here: everything a trip owns
 * (stops, costs with their linked expenses, fill-up links) leaves and comes back together.
 */
@Injectable()
export class TripBackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    private readonly costs: TripCostsService,
  ) {}

  /** The vehicle's trips and plans, oldest first. */
  async backupRows(userId: string, vehicleId: string): Promise<TripBackupRow[]> {
    const rows = await this.prisma.trip.findMany({
      where: { userId, vehicleId },
      include: {
        category: { select: { key: true, name: true } },
        stops: { orderBy: { position: "asc" } },
        costs: { orderBy: [{ date: "asc" }, { id: "asc" }] },
        fuelEntries: { select: { id: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({
      version: TRIP_BACKUP_VERSION,
      id: row.id,
      status: row.status,
      method: row.method,
      category: row.category,
      title: row.title,
      date: isoDate(row.date),
      endDate: row.endDate ? isoDate(row.endDate) : null,
      startTime: row.startTime,
      endTime: row.endTime,
      startKm: row.startKm,
      endKm: row.endKm,
      distanceKm: row.distanceKm?.toFixed(1) ?? null,
      plannedDistanceKm: row.plannedDistanceKm?.toFixed(1) ?? null,
      plannedDurationMinutes: row.plannedDurationMinutes,
      estMileage: money(row.estMileage),
      estFuelPrice: money(row.estFuelPrice),
      estToll: money(row.estToll),
      estParking: money(row.estParking),
      estAccommodation: money(row.estAccommodation),
      estOther: money(row.estOther),
      origin: row.origin,
      destination: row.destination,
      originLat: num(row.originLat),
      originLng: num(row.originLng),
      destinationLat: num(row.destinationLat),
      destinationLng: num(row.destinationLng),
      route:
        row.routeProvider && row.routeGeometry
          ? {
              provider: row.routeProvider,
              geometry: row.routeGeometry,
              durationMinutes: row.routeDurationMinutes ?? 0,
            }
          : null,
      notes: row.notes,
      stops: row.stops.map((stop) => ({
        label: stop.label,
        latitude: num(stop.latitude),
        longitude: num(stop.longitude),
        arrivalTime: stop.arrivalTime,
        departureTime: stop.departureTime,
        notes: stop.notes,
        day: stop.day,
        overnight: stop.overnight,
      })),
      costs: row.costs.map((cost) => ({
        category: cost.category,
        amount: cost.amount.toFixed(2),
        date: isoDate(cost.date),
        vendor: cost.vendor,
        paymentMethod: cost.paymentMethod,
        notes: cost.notes,
      })),
      fuelEntryIds: row.fuelEntries.map((entry) => entry.id),
    }));
  }

  /**
   * Recreates backed-up trips under `vehicleId` with new ids, in the caller's transaction. Each
   * row is checked as the API checks a new trip or plan (not against the odometer history: the
   * backup's own readings come back with it); a row that fails is skipped with the reason.
   * Linked fill-ups are re-linked through `fuelEntryIds` (backup id → restored id).
   */
  async restoreRows(
    tx: Prisma.TransactionClient,
    userId: string,
    vehicleId: string,
    rows: TripBackupRow[],
    { fuelEntryIds }: { fuelEntryIds?: Map<string, string> } = {},
  ): Promise<{ restored: number; skipped: { index: number; reason: string }[] }> {
    const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, userId } });
    if (!vehicle) throw new NotFoundException("Vehicle not found");
    const types = await tx.tripCategory.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, key: true, name: true, userId: true },
    });
    const skipped: { index: number; reason: string }[] = [];
    let restored = 0;

    for (const [index, row] of rows.entries()) {
      if (!(row.version >= 1 && row.version <= TRIP_BACKUP_VERSION)) {
        skipped.push({ index, reason: "Made by a newer version of AutoMate" });
        continue;
      }
      let type =
        (row.category.key && types.find((item) => item.key === row.category.key)) ||
        types.find(
          (item) => item.userId && item.name.toLowerCase() === row.category.name.toLowerCase(),
        );
      const fields = {
        vehicleId,
        title: row.title,
        date: row.date,
        endDate: row.endDate,
        startTime: row.startTime,
        origin: row.origin,
        destination: row.destination,
        originLat: row.originLat,
        originLng: row.originLng,
        destinationLat: row.destinationLat,
        destinationLng: row.destinationLng,
        stops: row.stops,
        notes: row.notes,
        // Checked with a stand-in; the real type is found or made below, once the row is valid.
        categoryId: type?.id ?? randomUUID(),
      };
      const done = row.status === "COMPLETED";
      const parsed = done
        ? createTripSchema.safeParse({
            ...fields,
            method: row.method,
            endTime: row.endTime,
            startKm: row.startKm,
            endKm: row.endKm,
            distanceKm: row.method === "DISTANCE" ? row.distanceKm : null,
          })
        : createTripPlanSchema.safeParse({
            ...fields,
            status: row.status === "CANCELLED" ? undefined : row.status,
            method: row.method === "ROUTE" ? "ROUTE" : "DISTANCE",
            plannedDistanceKm: row.plannedDistanceKm,
            plannedDurationMinutes: row.plannedDurationMinutes,
            estMileage: row.estMileage,
            estFuelPrice: row.estFuelPrice,
            estToll: row.estToll,
            estParking: row.estParking,
            estAccommodation: row.estAccommodation,
            estOther: row.estOther,
          });
      const costs = row.costs.map((cost) => createTripCostSchema.safeParse(cost));
      const invalid = !parsed.success
        ? parsed.error.issues[0]!.message
        : costs.find((cost) => !cost.success)?.error?.issues[0]?.message;
      const routed = row.method === "ROUTE";
      if (invalid || (routed && (!row.route || (done && !row.distanceKm)))) {
        skipped.push({ index, reason: invalid ?? "The route is missing" });
        continue;
      }
      if (!type) {
        type = await tx.tripCategory.create({
          data: { userId, name: row.category.name },
          select: { id: true, key: true, name: true, userId: true },
        });
        types.push(type);
      }
      const route: StoredRoute | null = row.route && {
        ...row.route,
        distanceKm: (done ? row.distanceKm : row.plannedDistanceKm) ?? "0.0",
      };
      const id = randomUUID();
      const decimal = (value: string | null) => (value == null ? null : new Prisma.Decimal(value));
      const data = done
        ? {
            ...columns(
              { ...(parsed.data as Parameters<typeof columns>[0]), categoryId: type.id },
              routed ? route : null,
            ),
            status: "COMPLETED" as const,
            // A trip done from a plan keeps the plan's figures.
            plannedDistanceKm: decimal(row.plannedDistanceKm),
            plannedDurationMinutes: row.plannedDurationMinutes,
            estMileage: decimal(row.estMileage),
            estFuelPrice: decimal(row.estFuelPrice),
            estToll: decimal(row.estToll),
            estParking: decimal(row.estParking),
            estAccommodation: decimal(row.estAccommodation),
            estOther: decimal(row.estOther),
          }
        : {
            ...planColumns(
              { ...(parsed.data as Parameters<typeof planColumns>[0]), categoryId: type.id },
              routed ? route : null,
            ),
            ...(row.status === "CANCELLED" && { status: "CANCELLED" as const }),
          };
      await tx.trip.create({ data: { ...data, id, userId, vehicleId } });
      await this.trips.writeStops(tx, id, row.stops);
      if (done) {
        for (const cost of costs) {
          const saved = await tx.tripCost.create({
            data: { ...costColumns(cost.data!), id: randomUUID(), userId, tripId: id },
            include: COST_INCLUDE,
          });
          await this.costs.syncExpense(tx, userId, saved, saved.trip);
        }
        const fills = row.fuelEntryIds
          .map((old) => fuelEntryIds?.get(old))
          .filter((value): value is string => !!value);
        if (fills.length) {
          await tx.fuelEntry.updateMany({
            where: { id: { in: fills }, vehicleId, tripId: null },
            data: { tripId: id },
          });
        }
      }
      restored += 1;
    }
    return { restored, skipped };
  }
}
