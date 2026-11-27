import {
  addDays,
  addMonths,
  type DateWindow,
  TripGranularity,
  windowLength,
} from "@automate/shared";

/** Days for short periods, weeks up to about six months, months beyond. */
export function chooseGranularity(window: DateWindow): TripGranularity {
  const days = windowLength(window);
  return days <= 31
    ? TripGranularity.DAY
    : days <= 186
      ? TripGranularity.WEEK
      : TripGranularity.MONTH;
}

/** The first day of the bucket holding `date` (weeks start on Monday, as Postgres' ISO weeks). */
export function bucketStart(date: string, granularity: TripGranularity): string {
  if (granularity === TripGranularity.MONTH) return `${date.slice(0, 7)}-01`;
  if (granularity === TripGranularity.WEEK) {
    return addDays(date, -((new Date(Date.parse(date)).getUTCDay() + 6) % 7));
  }
  return date;
}

/** Every bucket from the one holding `from` to the one holding `to`, so gaps show as 0 km. */
export function bucketStarts(window: DateWindow, granularity: TripGranularity): string[] {
  const starts: string[] = [];
  const step = (date: string) =>
    granularity === TripGranularity.MONTH
      ? addMonths(date, 1)
      : addDays(date, granularity === TripGranularity.WEEK ? 7 : 1);
  for (let start = bucketStart(window.from, granularity); start <= window.to; start = step(start)) {
    starts.push(start);
  }
  return starts;
}

/** Trips per week, one decimal; only over a window of at least a week. */
export function tripsPerWeek(trips: number, window: DateWindow): string | null {
  const days = windowLength(window);
  return days >= 7 ? ((trips * 7) / days).toFixed(1) : null;
}
