import {
  type PeriodWindow,
  type SystemTripCategoryKey,
  type TimeOfDay,
  TIMES_OF_DAY,
  TRIP_LENGTH_BANDS,
  type TripAnalytics,
  tripDays,
  tripDurationMinutes,
  type TripInsight,
  tripLabel,
  type TripLengthBand,
  type TripPeriodFigures,
} from "@automate/shared";

import { km } from "@/common/format";

/** One done trip, as the analytics read it (distance and cost as decimal strings). */
export type AnalyticsTrip = {
  id: string;
  vehicleId: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  distanceKm: string;
  title: string | null;
  origin: string | null;
  destination: string | null;
  category: { id: string; key: SystemTripCategoryKey | null; name: string };
  /** Recorded costs plus linked fill-ups; null when none. */
  cost: string | null;
};

/** Below this many trips in the period, there are no insights (too little to say anything). */
export const INSIGHT_MIN_TRIPS = 3;
const LONG_TRIP_KM = 100;
const SHARE_NOTICE = 40;

// Tenths of a km and paise, as integers: sums and shares stay exact.
const tenths = (value: string) => Math.round(Number(value) * 10);
const paise = (value: string) => Math.round(Number(value) * 100);
const kmText = (value: number) => (value / 10).toFixed(1);
const moneyText = (value: number) => (value / 100).toFixed(2);
const rupeesText = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
const kmLabel = (value: number) => km(Math.round(value / 10));

/** Percent change, rounded; null when there's nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export function lengthBand(distanceKm: string): TripLengthBand {
  const value = Number(distanceKm);
  if (value < 10) return "UNDER_10";
  if (value < 50) return "10_50";
  if (value < 100) return "50_100";
  if (value < 300) return "100_300";
  return "300_PLUS";
}

export function timeOfDay(startTime: string): TimeOfDay {
  const hour = Number(startTime.slice(0, 2));
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 21) return "EVENING";
  return "NIGHT";
}

/** Monday 1 … Sunday 7, for an ISO date. */
export const weekdayOf = (date: string) => ((new Date(Date.parse(date)).getUTCDay() + 6) % 7) + 1;

export function computeTripAnalytics(input: {
  period: PeriodWindow;
  /** The days the figures span (all time starts at the first trip). */
  shown: { from: string; to: string };
  vehicleId: string | null;
  trips: AnalyticsTrip[];
  previous: TripPeriodFigures;
  fuelEstimate: string | null;
  /** The last 3 complete months' km, oldest first (for the trend insight). */
  lastMonthsKm: string[];
}): TripAnalytics {
  const { trips } = input;
  const total = trips.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0);
  const costed = trips.filter((trip) => trip.cost !== null);
  const costTotal = costed.reduce((sum, trip) => sum + paise(trip.cost!), 0);
  const costKm = costed.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0);
  const current: TripPeriodFigures = {
    trips: trips.length,
    distanceKm: kmText(total),
    actualCost: costed.length ? moneyText(costTotal) : null,
  };
  const ref = (trip: AnalyticsTrip) => ({ id: trip.id, label: tripLabel(trip) });
  const byDistance = [...trips].sort(
    (a, b) => tenths(a.distanceKm) - tenths(b.distanceKm) || b.date.localeCompare(a.date),
  );
  const timed = trips
    .map((trip) => ({ trip, minutes: tripDurationMinutes(trip) }))
    .filter((row): row is { trip: AnalyticsTrip; minutes: number } => row.minutes !== null);
  const longestDrive = timed.reduce<(typeof timed)[number] | null>(
    (best, row) => (!best || row.minutes > best.minutes ? row : best),
    null,
  );
  const days = tripDays(input.shown.from, input.shown.to);

  const analytics: TripAnalytics = {
    period: input.period,
    vehicleId: input.vehicleId,
    current,
    previous: input.previous,
    change: {
      distance: percentChange(total, tenths(input.previous.distanceKm)),
      trips: percentChange(trips.length, input.previous.trips),
      cost:
        current.actualCost && input.previous.actualCost
          ? percentChange(costTotal, paise(input.previous.actualCost))
          : null,
    },
    distance: {
      averageKm: trips.length ? kmText(Math.round(total / trips.length)) : null,
      perDayKm: trips.length ? kmText(Math.round(total / days)) : null,
      shortest: byDistance[0]
        ? { ...ref(byDistance[0]), distanceKm: byDistance[0].distanceKm }
        : null,
      longest: byDistance.at(-1)
        ? { ...ref(byDistance.at(-1)!), distanceKm: byDistance.at(-1)!.distanceKm }
        : null,
      bands: TRIP_LENGTH_BANDS.map((band) => {
        const own = trips.filter((trip) => lengthBand(trip.distanceKm) === band);
        return {
          band,
          trips: own.length,
          distanceKm: kmText(own.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0)),
        };
      }),
    },
    time: {
      averageMinutes: timed.length
        ? Math.round(timed.reduce((sum, row) => sum + row.minutes, 0) / timed.length)
        : null,
      longest: longestDrive ? { ...ref(longestDrive.trip), minutes: longestDrive.minutes } : null,
      byWeekday: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
        const own = trips.filter((trip) => weekdayOf(trip.date) === weekday);
        return {
          weekday,
          trips: own.length,
          distanceKm: kmText(own.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0)),
        };
      }),
      byTimeOfDay: TIMES_OF_DAY.map((slot) => ({
        slot,
        trips: trips.filter((trip) => trip.startTime && timeOfDay(trip.startTime) === slot).length,
      })),
      untimedTrips: trips.filter((trip) => !trip.startTime).length,
    },
    cost: {
      actual: current.actualCost,
      perKm: costed.length && costKm > 0 ? moneyText(Math.round((costTotal * 10) / costKm)) : null,
      perTrip: costed.length ? moneyText(Math.round(costTotal / costed.length)) : null,
      tripsWithCost: costed.length,
      fuelEstimate: input.fuelEstimate,
    },
    byVehicle: input.vehicleId ? [] : byVehicle(trips),
    topDestinations: topDestinations(trips),
    insights: [],
  };
  analytics.insights = tripInsights(analytics, trips, input.lastMonthsKm);
  return analytics;
}

function byVehicle(trips: AnalyticsTrip[]): TripAnalytics["byVehicle"] {
  const groups = new Map<string, AnalyticsTrip[]>();
  for (const trip of trips)
    groups.set(trip.vehicleId, [...(groups.get(trip.vehicleId) ?? []), trip]);
  return [...groups.entries()]
    .map(([vehicleId, own]) => {
      const costed = own.filter((trip) => trip.cost !== null);
      return {
        vehicleId,
        trips: own.length,
        distance: own.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0),
        actualCost: costed.length
          ? moneyText(costed.reduce((sum, trip) => sum + paise(trip.cost!), 0))
          : null,
      };
    })
    .sort((a, b) => b.distance - a.distance)
    .map(({ distance, ...row }) => ({ ...row, distanceKm: kmText(distance) }));
}

/** Destinations typed the same way (ignoring case and spaces) at least twice. */
function topDestinations(trips: AnalyticsTrip[]): TripAnalytics["topDestinations"] {
  const counts = new Map<string, { destination: string; trips: number }>();
  for (const trip of trips) {
    const label = trip.destination?.trim();
    if (!label) continue;
    const key = label.toLowerCase().replace(/\s+/g, " ");
    const row = counts.get(key) ?? { destination: label, trips: 0 };
    row.trips += 1;
    counts.set(key, row);
  }
  return [...counts.values()]
    .filter((row) => row.trips >= 2)
    .sort((a, b) => b.trips - a.trips || a.destination.localeCompare(b.destination))
    .slice(0, 5);
}

/**
 * Deterministic findings from the period's trips (trips.md §1 "Insights"). Each needs enough
 * trips to mean something and says what it rests on; nothing is inferred beyond the records.
 */
export function tripInsights(
  analytics: TripAnalytics,
  trips: AnalyticsTrip[],
  lastMonthsKm: string[],
): TripInsight[] {
  if (trips.length < INSIGHT_MIN_TRIPS) return [];
  const insights: TripInsight[] = [];
  const total = tenths(analytics.current.distanceKm);
  const { from, to } = analytics.period;
  // History's own URL filters; "all" keeps every vehicle in view.
  const scope = `vehicle=${analytics.vehicleId ?? "all"}&from=${from}&to=${to}`;

  const change = analytics.change.distance;
  if (change !== null && change !== 0) {
    insights.push({
      key: "distance_change",
      title: `Distance ${change > 0 ? "up" : "down"} ${Math.abs(change)}%`,
      detail: `${kmLabel(total)} this period, ${Math.abs(change)}% ${change > 0 ? "more" : "less"} than the period before (${kmLabel(tenths(analytics.previous.distanceKm))}).`,
      link: null,
    });
  }

  const long = trips.filter((trip) => Number(trip.distanceKm) >= LONG_TRIP_KM);
  if (long.length > 0 && total > 0) {
    const longKm = long.reduce((sum, trip) => sum + tenths(trip.distanceKm), 0);
    insights.push({
      key: "long_trips",
      title: `${long.length} ${long.length === 1 ? "trip" : "trips"} of ${LONG_TRIP_KM} km or more`,
      detail: `They covered ${kmLabel(longKm)}, ${Math.round((longKm / total) * 100)}% of your distance.`,
      link: `/trips/history?minKm=${LONG_TRIP_KM}&${scope}`,
    });
  }

  const categories = new Map<string, { id: string; name: string; km: number; trips: number }>();
  for (const trip of trips) {
    const row = categories.get(trip.category.id) ?? { ...trip.category, km: 0, trips: 0 };
    row.km += tenths(trip.distanceKm);
    row.trips += 1;
    categories.set(trip.category.id, row);
  }
  const top = [...categories.values()].sort((a, b) => b.km - a.km)[0];
  const share = top && total > 0 ? Math.round((top.km / total) * 100) : 0;
  if (top && top.trips >= 2 && share >= SHARE_NOTICE && categories.size > 1) {
    insights.push({
      key: "category_share",
      title: `${top.name}: ${share}% of your distance`,
      detail: `${top.trips} ${top.name.toLowerCase()} trips covered ${kmLabel(top.km)} of ${kmLabel(total)}.`,
      link: `/trips/history?type=${top.id}&${scope}`,
    });
  }

  if (analytics.cost.perKm) {
    insights.push({
      key: "cost_per_km",
      title: `Trip costs averaged ${rupeesText(paise(analytics.cost.perKm))} per km`,
      detail: `Over ${analytics.cost.tripsWithCost} ${analytics.cost.tripsWithCost === 1 ? "trip" : "trips"} with recorded costs; fuel estimates aren't included.`,
      link: "/trips/costs",
    });
  }

  if (trips.length >= 5) {
    const weekend = trips.filter((trip) => weekdayOf(trip.date) >= 6).length;
    if (weekend * 2 > trips.length) {
      insights.push({
        key: "weekdays",
        title: "Most trips were on weekends",
        detail: `${weekend} of ${trips.length} trips started on a Saturday or Sunday.`,
        link: null,
      });
    } else if ((trips.length - weekend) * 10 >= trips.length * 8) {
      insights.push({
        key: "weekdays",
        title: "Mostly weekday driving",
        detail: `${trips.length - weekend} of ${trips.length} trips started Monday to Friday.`,
        link: null,
      });
    }
  }

  const months = lastMonthsKm.map(tenths);
  if (months.length === 3 && months.every((value) => value > 0)) {
    const rising = months[0]! < months[1]! && months[1]! < months[2]!;
    const falling = months[0]! > months[1]! && months[1]! > months[2]!;
    if (rising || falling) {
      insights.push({
        key: "trend",
        title: `Monthly distance has ${rising ? "grown" : "fallen"} for 3 months`,
        detail: months.map(kmLabel).join(" → ") + " over the last 3 full months.",
        link: null,
      });
    }
  }
  return insights;
}
