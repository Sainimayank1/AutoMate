import { z } from "zod";

import { checkPeriodQuery, type PeriodWindow, periodQueryFields } from "../common/periods.js";

/** `GET /trips/analytics`: one vehicle or all, over a period (compared with the one before). */
export const tripAnalyticsQuerySchema = z
  .object({ vehicleId: z.uuid().optional(), ...periodQueryFields })
  .superRefine(checkPeriodQuery);
export type TripAnalyticsQuery = z.output<typeof tripAnalyticsQuerySchema>;

export const TRIP_LENGTH_BANDS = ["UNDER_10", "10_50", "50_100", "100_300", "300_PLUS"] as const;
export type TripLengthBand = (typeof TRIP_LENGTH_BANDS)[number];
/** From the start time: morning 05–12, afternoon 12–17, evening 17–21, night 21–05. */
export const TIMES_OF_DAY = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface TripPeriodFigures {
  trips: number;
  distanceKm: string;
  /** Recorded costs and linked fill-ups of the period's trips; null when none. */
  actualCost: string | null;
}

/** A finding from the records; never a guess. `link` opens the trips it's about. */
export interface TripInsight {
  key: "distance_change" | "long_trips" | "category_share" | "cost_per_km" | "weekdays" | "trend";
  title: string;
  detail: string;
  link: string | null;
}

type TripRef = { id: string; label: string };

export interface TripAnalytics {
  period: PeriodWindow;
  vehicleId: string | null;
  current: TripPeriodFigures;
  previous: TripPeriodFigures;
  /** Percent change from the previous period; null when that figure was 0 or unknown. */
  change: { distance: number | null; trips: number | null; cost: number | null };
  distance: {
    averageKm: string | null;
    /** Over the period's days (all time: from the first trip). */
    perDayKm: string | null;
    shortest: (TripRef & { distanceKm: string }) | null;
    longest: (TripRef & { distanceKm: string }) | null;
    bands: { band: TripLengthBand; trips: number; distanceKm: string }[];
  };
  time: {
    /** Over the trips with both times. */
    averageMinutes: number | null;
    longest: (TripRef & { minutes: number }) | null;
    /** Monday (1) to Sunday (7). */
    byWeekday: { weekday: number; trips: number; distanceKm: string }[];
    byTimeOfDay: { slot: TimeOfDay; trips: number }[];
    /** Trips without a start time (not in `byTimeOfDay`). */
    untimedTrips: number;
  };
  cost: {
    actual: string | null;
    perKm: string | null;
    perTrip: string | null;
    tripsWithCost: number;
    /** Fuel for the period's distance from each vehicle's fuel figures; an estimate, never spending. */
    fuelEstimate: string | null;
  };
  /** All vehicles only; empty for one vehicle. */
  byVehicle: { vehicleId: string; trips: number; distanceKm: string; actualCost: string | null }[];
  /** Destinations reached at least twice, most visited first (up to 5). */
  topDestinations: { destination: string; trips: number }[];
  insights: TripInsight[];
}
