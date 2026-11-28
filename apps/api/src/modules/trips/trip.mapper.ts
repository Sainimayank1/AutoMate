import {
  type CreateTripValues,
  planBudget,
  type SystemTripCategoryKey,
  type Trip,
  tripDurationMinutes,
} from "@automate/shared";

import type { Prisma } from "@/generated/prisma/client";

export const TRIP_INCLUDE = {
  category: { select: { id: true, key: true, name: true } },
  stops: { orderBy: { position: "asc" } },
} as const satisfies Prisma.TripInclude;
export type TripRow = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>;

export const isoDate = (value: Date) => value.toISOString().slice(0, 10);
/** "YYYY-MM-DD" as the DATE column's value (midnight UTC). */
export const toDbDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

/** `actualCost`: the trip's recorded costs plus linked fill-ups (null when none). */
export function toTrip(row: TripRow, actualCost: string | null = null): Trip {
  const date = isoDate(row.date);
  const endDate = row.endDate ? isoDate(row.endDate) : null;
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    method: row.method,
    category: { ...row.category, key: row.category.key as SystemTripCategoryKey | null },
    title: row.title,
    date,
    endDate,
    startTime: row.startTime,
    endTime: row.endTime,
    startKm: row.startKm,
    endKm: row.endKm,
    distanceKm: row.distanceKm!.toFixed(1), // done trips always have one (trips_status_check)
    durationMinutes: tripDurationMinutes({
      date,
      endDate,
      startTime: row.startTime,
      endTime: row.endTime,
    }),
    origin: row.origin,
    destination: row.destination,
    notes: row.notes,
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
            distanceKm: row.distanceKm!.toFixed(1),
            durationMinutes: row.routeDurationMinutes ?? 0,
            geometry: row.routeGeometry,
          }
        : null,
    actualCost,
    plan: planOf(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A stored trip as create input, so a PATCH can be merged and re-checked whole. */
export function asTripInput(row: TripRow): CreateTripValues {
  return {
    vehicleId: row.vehicleId,
    method: row.method,
    categoryId: row.categoryId,
    title: row.title,
    date: isoDate(row.date),
    endDate: row.endDate ? isoDate(row.endDate) : null,
    startTime: row.startTime,
    endTime: row.endTime,
    startKm: row.startKm,
    endKm: row.endKm,
    distanceKm: row.method === "DISTANCE" ? (row.distanceKm?.toFixed(1) ?? null) : null,
    origin: row.origin,
    destination: row.destination,
    originLat: row.originLat?.toNumber() ?? null,
    originLng: row.originLng?.toNumber() ?? null,
    destinationLat: row.destinationLat?.toNumber() ?? null,
    destinationLng: row.destinationLng?.toNumber() ?? null,
    stops: row.stops.map((stop) => ({
      label: stop.label,
      latitude: stop.latitude?.toNumber() ?? null,
      longitude: stop.longitude?.toNumber() ?? null,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      notes: stop.notes,
      day: stop.day,
      overnight: stop.overnight,
    })),
    notes: row.notes,
  };
}

const point = (lat: Prisma.Decimal | null, lng: Prisma.Decimal | null) =>
  lat && lng ? { latitude: lat.toNumber(), longitude: lng.toNumber() } : null;

/** The plan a done trip came from, for planned vs actual (null when it wasn't planned). */
export function planOf(row: TripRow): Trip["plan"] {
  const estimates = planEstimates(row);
  if (!row.plannedDistanceKm && !Object.values(estimates).some(Boolean)) return null;
  return {
    distanceKm: row.plannedDistanceKm?.toFixed(1) ?? null,
    durationMinutes: row.plannedDurationMinutes,
    budget: planBudget(estimates).total,
  };
}

/** A trip's plan columns as strings (the shape `planBudget` and the API use). */
export function planEstimates(row: TripRow) {
  const text = (value: { toFixed: (digits: number) => string } | null, digits = 2) =>
    value?.toFixed(digits) ?? null;
  return {
    plannedDistanceKm: text(row.plannedDistanceKm, 1),
    estMileage: text(row.estMileage),
    estFuelPrice: text(row.estFuelPrice),
    estToll: text(row.estToll),
    estParking: text(row.estParking),
    estAccommodation: text(row.estAccommodation),
    estOther: text(row.estOther),
  };
}
