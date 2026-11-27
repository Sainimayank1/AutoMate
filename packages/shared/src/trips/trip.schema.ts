import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  latestAllowedDate,
  optionalDate,
  optionalDecimal,
  optionalInt,
  optionalText,
} from "../common/fields.js";
import { checkPeriodQuery, type PeriodWindow, periodQueryFields } from "../common/periods.js";
import { ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";

/** Trips contract (module 7). Rules: docs/architecture/trips.md. */

/** How the distance is known: from two odometer readings, or entered by the user. */
export const TripMethod = { ODOMETER: "ODOMETER", DISTANCE: "DISTANCE" } as const;
export type TripMethod = (typeof TripMethod)[keyof typeof TripMethod];

/** The default trip types every user has; users add their own beside them. */
export const SYSTEM_TRIP_CATEGORIES = [
  ["PERSONAL", "Personal"],
  ["COMMUTE", "Commute"],
  ["BUSINESS", "Business"],
  ["ROAD_TRIP", "Road trip"],
  ["ERRANDS", "Errands"],
  ["AIRPORT_RAILWAY", "Airport / railway"],
  ["OTHER", "Other"],
] as const;
export type SystemTripCategoryKey = (typeof SYSTEM_TRIP_CATEGORIES)[number][0];

/** A trip longer than this in a day is shown a "check the readings" warning (never refused). */
export const TRIP_DAY_KM_NOTICE = 1500;
export const TRIP_DISTANCE_MAX_KM = 99_999;

const odometer = (message: string) => optionalInt(0, ODOMETER_MAX_KM, message);
const time = z
  .preprocess(
    (value) => (value === "" ? null : value),
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM")
      .nullable(),
  )
  .optional();

export const tripFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same trip. */
  id: z.uuid("Invalid id").optional(),
  vehicleId: z.uuid("Choose a vehicle"),
  method: z.enum(TripMethod, { error: "Choose how the distance is known" }),
  categoryId: z.uuid("Choose a trip type"),
  title: optionalText(80),
  date: z.iso
    .date("Enter the date")
    .refine((date) => date <= latestAllowedDate(), "This date is in the future"),
  /** Overnight and multi-day trips; the same day when empty. */
  endDate: optionalDate({ pastOnly: true }),
  startTime: time,
  endTime: time,
  startKm: odometer("Enter the starting odometer"),
  endKm: odometer("Enter the ending odometer"),
  /** Entered distance (method DISTANCE); computed from the readings otherwise. */
  distanceKm: optionalDecimal(5, 1, "Enter the distance in km"),
  origin: optionalText(120),
  destination: optionalText(120),
  notes: optionalText(1000),
});

type TripCheckInput = {
  method?: TripMethod;
  date?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startKm?: number | null;
  endKm?: number | null;
  distanceKm?: string | null;
};

/** The rules between fields. Run on whole trips only (the API merges a PATCH first). */
export function checkTrip(values: TripCheckInput, ctx: z.RefinementCtx) {
  const issue = (path: keyof TripCheckInput, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });
  if (values.method === TripMethod.ODOMETER) {
    if (values.startKm == null) issue("startKm", "Enter the starting odometer");
    if (values.endKm == null) issue("endKm", "Enter the ending odometer");
    if (values.startKm != null && values.endKm != null && values.endKm <= values.startKm) {
      issue("endKm", "Must be more than the starting odometer");
    }
  }
  if (values.method === TripMethod.DISTANCE) {
    if (values.distanceKm == null || !/[1-9]/.test(values.distanceKm)) {
      issue("distanceKm", "Enter the distance in km");
    } else if (Number(values.distanceKm) > TRIP_DISTANCE_MAX_KM) {
      issue("distanceKm", "That's too far for one trip");
    }
  }
  if (values.date && values.endDate && values.endDate < values.date) {
    issue("endDate", "Ends before it starts");
  }
  const sameDay = !values.endDate || values.endDate === values.date;
  if (sameDay && values.startTime && values.endTime && values.endTime < values.startTime) {
    issue("endTime", "Ends before it starts");
  }
}

/** km of a trip: end − start from the readings, or as entered. Null until it's known. */
export function tripDistance(values: {
  method?: TripMethod;
  startKm?: number | null;
  endKm?: number | null;
  distanceKm?: string | null;
}): string | null {
  if (values.method === TripMethod.ODOMETER) {
    return values.startKm != null && values.endKm != null && values.endKm > values.startKm
      ? String(values.endKm - values.startKm)
      : null;
  }
  return values.distanceKm && /[1-9]/.test(values.distanceKm) ? values.distanceKm : null;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Minutes from start to end, across days; null unless both times are known. */
export function tripDurationMinutes(values: {
  date?: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}): number | null {
  if (!values.date || !values.startTime || !values.endTime) return null;
  const days = values.endDate
    ? Math.round((Date.parse(values.endDate) - Date.parse(values.date)) / 86_400_000)
    : 0;
  const minutes = days * 1440 + minutesOf(values.endTime) - minutesOf(values.startTime);
  return minutes >= 0 ? minutes : null;
}

export const createTripSchema = tripFieldsSchema.superRefine(checkTrip);
/** PATCH: the vehicle can't change (delete and log it again). The API re-checks the whole trip. */
export const updateTripSchema = tripFieldsSchema.omit({ id: true, vehicleId: true }).partial();

export const tripListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid().optional(),
});

export const TripGranularity = { DAY: "day", WEEK: "week", MONTH: "month" } as const;
export type TripGranularity = (typeof TripGranularity)[keyof typeof TripGranularity];

/** `GET /trips/overview`: one vehicle, or all of the user's when `vehicleId` is left out. */
export const tripOverviewQuerySchema = z
  .object({
    vehicleId: z.uuid().optional(),
    ...periodQueryFields,
    granularity: z.enum(TripGranularity).optional(),
  })
  .superRefine(checkPeriodQuery);

export const tripCategoryFieldsSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
});

export type CreateTripValues = z.output<typeof createTripSchema>;
export type UpdateTripValues = z.output<typeof updateTripSchema>;
export type TripListQuery = z.output<typeof tripListQuerySchema>;
export type TripOverviewQuery = z.output<typeof tripOverviewQuerySchema>;
export type TripCategoryValues = z.output<typeof tripCategoryFieldsSchema>;

// ---- responses

export interface TripCategory {
  id: string;
  /** System types only ("COMMUTE"); null for the user's own. */
  key: SystemTripCategoryKey | null;
  name: string;
  archivedAt: string | null;
}

export interface Trip {
  id: string;
  vehicleId: string;
  method: TripMethod;
  category: Pick<TripCategory, "id" | "key" | "name">;
  title: string | null;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  startKm: number | null;
  endKm: number | null;
  /** Always set: from the readings, or as entered. One decimal, as a string. */
  distanceKm: string;
  /** Only when both times are known. */
  durationMinutes: number | null;
  origin: string | null;
  destination: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripOverview {
  period: PeriodWindow;
  /** Null for all vehicles. */
  vehicleId: string | null;
  trips: number;
  distanceKm: string;
  averageKm: string | null;
  longest: { id: string; distanceKm: string; label: string } | null;
  /** Over the trips with both times; null when none has them. */
  drivingMinutes: number | null;
  timedTrips: number;
  /** Trips per week across the period (null for a period under a week with no trips). */
  perWeek: string | null;
  byCategory: {
    categoryId: string;
    key: SystemTripCategoryKey | null;
    name: string;
    trips: number;
    distanceKm: string;
  }[];
  series: {
    granularity: TripGranularity;
    points: { start: string; distanceKm: string; trips: number }[];
  };
  recent: Trip[];
}
