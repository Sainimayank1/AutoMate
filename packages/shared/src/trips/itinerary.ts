import type { z } from "zod";

import { addDays } from "../common/periods.js";
import { fromPaise, toPaise } from "../expenses/expense.schema.js";

/** What the itinerary rules read from a stop. */
export type ItineraryStop = {
  label?: string;
  day?: number | null;
  overnight?: boolean | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
};

const MINUTES_PER_DAY = 24 * 60;
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Days a trip spans, start and end included (1 for a same-day trip). */
export function tripDays(date: string, endDate?: string | null): number {
  if (!endDate || endDate <= date) return 1;
  return Math.round((Date.parse(endDate) - Date.parse(date)) / 86_400_000) + 1;
}

/** Each stop's day: its own, else the previous stop's (day 1 for the first). */
export function stopDays(stops: ItineraryStop[]): number[] {
  let day = 1;
  return stops.map((stop) => (day = stop.day ?? day));
}

/** Minutes between arrival and departure at a stop; null unless both are known and in order. */
export function stayMinutes(stop: ItineraryStop): number | null {
  if (!stop.arrivalTime || !stop.departureTime) return null;
  const minutes = minutesOf(stop.departureTime) - minutesOf(stop.arrivalTime);
  return minutes >= 0 && minutes < MINUTES_PER_DAY ? minutes : null;
}

/**
 * Road-trip rules: stops keep the route's order, so their days never go back; a day fits in the
 * trip's dates; a night is spent at the last stop of its day, and never on the last day (it ends
 * at the destination).
 */
export function checkItinerary(
  values: { date?: string; endDate?: string | null; stops?: ItineraryStop[] },
  ctx: z.RefinementCtx,
) {
  if (!values.date || !values.stops?.length) return;
  const days = tripDays(values.date, values.endDate);
  const resolved = stopDays(values.stops);
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const last = Math.max(...resolved);
  if (last > days) {
    issue(
      ["endDate"],
      `The itinerary goes to day ${last}: set a later end date or move those stops`,
    );
  }
  values.stops.forEach((stop, index) => {
    const day = resolved[index]!;
    if (index > 0 && day < resolved[index - 1]!) {
      issue(["stops", index, "day"], "Earlier than the stop before it");
    }
    if (!stop.overnight) return;
    if (day >= days) issue(["stops", index, "overnight"], "The last day ends at the destination");
    else if (resolved[index + 1] === day) {
      issue(["stops", index, "overnight"], "The night is spent at the last stop of the day");
    }
  });
}

export interface ItineraryDay<S> {
  day: number;
  date: string;
  /** Where the day starts: the origin on day 1, else the previous night's stop (null if unknown). */
  from: string | null;
  stops: (S & { day: number; stayMinutes: number | null })[];
  /** Where the night is spent; null on the last day or when it isn't set. */
  night: string | null;
  /** The destination, on the last day only. */
  to: string | null;
}

/** A trip day by day: its stops in route order, where each day starts and where each night is. */
export function tripItinerary<S extends ItineraryStop>(trip: {
  date: string;
  endDate: string | null;
  origin: string | null;
  destination: string | null;
  stops: S[];
}): ItineraryDay<S>[] {
  const days = tripDays(trip.date, trip.endDate);
  const resolved = stopDays(trip.stops);
  const stops = trip.stops.map((stop, index) => ({
    ...stop,
    day: resolved[index]!,
    stayMinutes: stayMinutes(stop),
  }));
  let from = trip.origin;
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const own = stops.filter((stop) => stop.day === day);
    const night = day < days ? (own.find((stop) => stop.overnight)?.label ?? null) : null;
    const entry = {
      day,
      date: addDays(trip.date, index),
      from,
      stops: own,
      night,
      to: day === days ? trip.destination : null,
    };
    from = night;
    return entry;
  });
}

/** Where today falls in a trip's dates: before it, on day N of M, or after it. */
export function tripProgress(
  date: string,
  endDate: string | null,
  today: string,
): { state: "upcoming" | "in_progress" | "ended"; day: number; of: number } {
  const of = tripDays(date, endDate);
  if (today < date) return { state: "upcoming", day: 0, of };
  const day = tripDays(date, today);
  return day > of ? { state: "ended", day: of, of } : { state: "in_progress", day, of };
}

/** A done road trip in figures: days, nights, km and actual cost per day (null when unknown). */
export function roadTripSummary(trip: {
  date: string;
  endDate: string | null;
  distanceKm: string;
  actualCost: string | null;
  stops: ItineraryStop[];
}): { days: number; nights: number; kmPerDay: string; costPerDay: string | null } {
  const days = tripDays(trip.date, trip.endDate);
  const tenths = Math.round(Number(trip.distanceKm) * 10);
  return {
    days,
    nights: trip.stops.filter((stop) => stop.overnight).length,
    kmPerDay: (Math.round(tenths / days) / 10).toFixed(1),
    costPerDay: trip.actualCost ? fromPaise(Math.round(toPaise(trip.actualCost) / days)) : null,
  };
}
