import {
  type CreateTripValues,
  type SystemTripCategoryKey,
  type Trip,
  tripDurationMinutes,
} from "@automate/shared";

import type { Prisma } from "@/generated/prisma/client";

export const TRIP_INCLUDE = {
  category: { select: { id: true, key: true, name: true } },
} as const satisfies Prisma.TripInclude;
export type TripRow = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>;

export const isoDate = (value: Date) => value.toISOString().slice(0, 10);
/** "YYYY-MM-DD" as the DATE column's value (midnight UTC). */
export const toDbDate = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

export function toTrip(row: TripRow): Trip {
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
    distanceKm: row.distanceKm.toFixed(1),
    durationMinutes: tripDurationMinutes({
      date,
      endDate,
      startTime: row.startTime,
      endTime: row.endTime,
    }),
    origin: row.origin,
    destination: row.destination,
    notes: row.notes,
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
    distanceKm: row.method === "DISTANCE" ? row.distanceKm.toFixed(1) : null,
    origin: row.origin,
    destination: row.destination,
    notes: row.notes,
  };
}
