import { z } from "zod";

/**
 * Calendar periods in India (IST) as inclusive "YYYY-MM-DD" windows, each with the window it's
 * compared with: like for like, so "this month so far" is compared with the same days of last
 * month (never all of it) and a rolling or custom window with the same number of days just before
 * it (docs/architecture/dashboard.md §2).
 */

/** Both ends included. */
export interface DateWindow {
  from: string;
  to: string;
}

export const ReportingPeriod = {
  THIS_MONTH: "this_month",
  LAST_MONTH: "last_month",
  LAST_3_MONTHS: "last_3_months",
  THIS_YEAR: "this_year",
  LAST_12_MONTHS: "last_12_months",
  CUSTOM: "custom",
} as const;
export type ReportingPeriod = (typeof ReportingPeriod)[keyof typeof ReportingPeriod];

export interface PeriodWindow extends DateWindow {
  period: ReportingPeriod;
  /** The same-length window just before (or the same days a month / year earlier). */
  previous: DateWindow;
  /** Still running: it ends today, so its figures are "so far". */
  endsToday: boolean;
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in India. */
export const istToday = (now: Date) =>
  new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

const pad = (value: number) => String(value).padStart(2, "0");
const day = (year: number, month: number, date: number) => `${year}-${pad(month)}-${pad(date)}`;
const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

/** The same day `months` later (or earlier), clamped to that month: 31 Mar − 1 month = 28/29 Feb. */
export function addMonths(date: string, months: number) {
  const [year, month, dayOfMonth] = parts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return day(targetYear, targetMonth, Math.min(dayOfMonth, daysIn(targetYear, targetMonth)));
}

/** Days in a window, both ends counted. */
export const windowLength = ({ from, to }: DateWindow) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;

/** The window with the same number of days just before `window`. */
const before = (window: DateWindow): DateWindow => ({
  from: addDays(window.from, -windowLength(window)),
  to: addDays(window.from, -1),
});

/** The window for a period, as of `now` (custom needs `custom`). */
export function resolvePeriod(
  period: ReportingPeriod,
  now: Date,
  custom?: DateWindow,
): PeriodWindow {
  const today = istToday(now);
  const [year, month] = parts(today);
  const monthStart = day(year, month, 1);
  let window: DateWindow;
  let previous: DateWindow;
  switch (period) {
    case ReportingPeriod.THIS_MONTH:
      window = { from: monthStart, to: today };
      previous = { from: addMonths(monthStart, -1), to: addMonths(today, -1) };
      break;
    case ReportingPeriod.LAST_MONTH: {
      const from = addMonths(monthStart, -1);
      window = { from, to: addDays(monthStart, -1) };
      previous = { from: addMonths(from, -1), to: addDays(from, -1) };
      break;
    }
    case ReportingPeriod.LAST_3_MONTHS:
    case ReportingPeriod.LAST_12_MONTHS: {
      const months = period === ReportingPeriod.LAST_3_MONTHS ? 3 : 12;
      window = { from: addDays(addMonths(today, -months), 1), to: today };
      previous = before(window);
      break;
    }
    case ReportingPeriod.THIS_YEAR:
      window = { from: day(year, 1, 1), to: today };
      previous = { from: day(year - 1, 1, 1), to: addMonths(today, -12) };
      break;
    case ReportingPeriod.CUSTOM: {
      if (!custom) throw new Error("A custom period needs its dates");
      window = custom;
      previous = before(custom);
      break;
    }
  }
  return { period, ...window, previous, endsToday: window.to >= today };
}

// ---- the period in a query (`?period=…&from=…&to=…`)

/** No records before it. */
export const EARLIEST_PERIOD_DATE = "2000-01-01";

/** Query fields for a period: this month by default; `from` and `to` only for a custom one. */
export const periodQueryFields = {
  period: z.enum(ReportingPeriod).default(ReportingPeriod.THIS_MONTH),
  from: z.iso.date("Enter a valid date").optional(),
  to: z.iso.date("Enter a valid date").optional(),
};

/** Refinement for `periodQueryFields`: a custom period needs both dates, 2000 → today (IST). */
export function checkPeriodQuery(
  value: { period: ReportingPeriod; from?: string; to?: string },
  ctx: z.RefinementCtx,
) {
  if (value.period !== ReportingPeriod.CUSTOM) return;
  const issue = (path: "from" | "to", message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });
  if (!value.from) issue("from", "Choose the start date");
  else if (value.from < EARLIEST_PERIOD_DATE) issue("from", "Choose a date from 2000 onwards");
  if (!value.to) issue("to", "Choose the end date");
  else if (value.to > istToday(new Date())) issue("to", "This date is in the future");
  if (value.from && value.to && value.from > value.to) issue("to", "Ends before it starts");
}

const isDay = (value: string | undefined): value is string =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(Date.parse(value)).toISOString().startsWith(value);

/**
 * A usable custom window from whatever a URL holds: a missing or malformed date falls back to this
 * month's, a backwards range is turned round, and both ends stay between 2000 and today (IST).
 */
export function customWindow(
  from: string | undefined,
  to: string | undefined,
  now: Date,
): DateWindow {
  const today = istToday(now);
  const month = resolvePeriod(ReportingPeriod.THIS_MONTH, now);
  const clamp = (date: string) =>
    date < EARLIEST_PERIOD_DATE ? EARLIEST_PERIOD_DATE : date > today ? today : date;
  const start = clamp(isDay(from) ? from : month.from);
  const end = clamp(isDay(to) ? to : month.to);
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
