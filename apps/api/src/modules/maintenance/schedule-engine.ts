import {
  addMonths,
  DEFAULT_REMINDER_LEAD,
  DUE_WINDOW,
  MaintenanceState,
  ScheduleBasis,
  type ScheduleDateTrack,
  type ScheduleDistanceTrack,
  type ScheduleDue,
  type SchedulePriority,
  ScheduleStatus,
  UPCOMING_WINDOW,
} from "@automate/shared";

/** What the engine needs from a schedule. Dates are "YYYY-MM-DD" (IST). */
export interface ScheduleFacts {
  intervalKm: number | null;
  intervalMonths: number | null;
  dueDate: string | null;
  dueKm: number | null;
  lastDoneDate: string | null;
  lastDoneKm: number | null;
  addedDate: string;
  addedOdometerKm: number;
  leadDays: number | null;
  leadKm: number | null;
  paused: boolean;
  /** Logged services that completed it (service record items), any order. */
  completions: { date: string; km: number | null }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Most urgent first; PAUSED and NOT_CONFIGURED never outrank an active status. */
const RANK: Record<ScheduleStatus, number> = {
  OVERDUE: 6,
  DUE: 5,
  DUE_SOON: 4,
  UPCOMING: 3,
  UP_TO_DATE: 2,
  PAUSED: 1,
  COMPLETED: 0,
  NOT_CONFIGURED: 0,
};

function trackStatus(remaining: number, due: number, lead: number, upcoming: number) {
  if (remaining < 0) return ScheduleStatus.OVERDUE;
  if (remaining <= due) return ScheduleStatus.DUE;
  if (remaining <= lead) return ScheduleStatus.DUE_SOON;
  if (remaining <= upcoming) return ScheduleStatus.UPCOMING;
  return ScheduleStatus.UP_TO_DATE;
}

/**
 * The latest known "done" on one track: the highest date (or reading) among the logged services
 * and the user's "last done". Each track uses its own latest point, so a service logged without a
 * reading still restarts the date track.
 */
function latestDone<T extends string | number>(
  facts: ScheduleFacts,
  pick: (point: { date: string | null; km: number | null }) => T | null,
): { value: T; basis: ScheduleBasis } | null {
  type Point = { value: T; basis: ScheduleBasis };
  const candidates: { value: T | null; basis: ScheduleBasis }[] = [
    ...facts.completions.map((point) => ({ value: pick(point), basis: ScheduleBasis.COMPLETION })),
    {
      value: pick({ date: facts.lastDoneDate, km: facts.lastDoneKm }),
      basis: ScheduleBasis.LAST_DONE,
    },
  ];
  let best: Point | null = null;
  // Ties go to the logged service (listed first): it's the record behind the date.
  for (const point of candidates) {
    if (point.value != null && (!best || point.value > best.value)) best = point as Point;
  }
  return best;
}

function dateTrack(facts: ScheduleFacts, today: string): ScheduleDateTrack | null {
  let from: string | null = null;
  let basis: ScheduleBasis = ScheduleBasis.FIXED;
  let nextDue: string;
  if (facts.intervalMonths != null) {
    // The latest of the logged services and the user's "last done"; else the day it was added.
    const done = latestDone(facts, (point) => point.date);
    from = done?.value ?? facts.addedDate;
    basis = done?.basis ?? ScheduleBasis.ADDED;
    nextDue = addMonths(from, facts.intervalMonths);
  } else if (facts.dueDate) {
    nextDue = facts.dueDate;
  } else return null;
  const daysRemaining = daysBetween(today, nextDue);
  const lead = facts.leadDays ?? DEFAULT_REMINDER_LEAD.days;
  const status = trackStatus(daysRemaining, DUE_WINDOW.days, lead, UPCOMING_WINDOW.days);
  return { from, basis, nextDue, daysRemaining, status };
}

function distanceTrack(facts: ScheduleFacts, odometerKm: number): ScheduleDistanceTrack | null {
  let fromKm: number | null = null;
  let basis: ScheduleBasis = ScheduleBasis.FIXED;
  let nextDueKm: number;
  if (facts.intervalKm != null) {
    const done = latestDone(facts, (point) => point.km);
    fromKm = done?.value ?? facts.addedOdometerKm;
    basis = done?.basis ?? ScheduleBasis.ADDED;
    nextDueKm = fromKm + facts.intervalKm;
  } else if (facts.dueKm != null) {
    nextDueKm = facts.dueKm;
  } else return null;
  const kmRemaining = nextDueKm - odometerKm;
  const lead = facts.leadKm ?? DEFAULT_REMINDER_LEAD.km;
  const status = trackStatus(kmRemaining, DUE_WINDOW.km, lead, UPCOMING_WINDOW.km);
  return { fromKm, basis, nextDueKm, kmRemaining, status };
}

/**
 * Next due and status of a schedule (docs/architecture/maintenance.md §2). Each track counts from
 * its own latest known point; the more urgent track sets the status (whichever comes first).
 */
export function computeDue(facts: ScheduleFacts, odometerKm: number, today: string): ScheduleDue {
  const date = dateTrack(facts, today);
  const distance = distanceTrack(facts, odometerKm);
  // On a tie the date track is named: a calendar date is the clearer reason to give.
  const decidedBy =
    date && (!distance || RANK[date.status] >= RANK[distance.status])
      ? "DATE"
      : distance
        ? "DISTANCE"
        : null;
  const decided = decidedBy === "DATE" ? date!.status : decidedBy ? distance!.status : null;
  const once = facts.intervalKm == null && facts.intervalMonths == null;
  const status =
    once && facts.completions.length > 0
      ? ScheduleStatus.COMPLETED
      : facts.paused
        ? ScheduleStatus.PAUSED
        : (decided ?? ScheduleStatus.NOT_CONFIGURED);
  return { status, decidedBy, date, distance };
}

const PRIORITY_RANK: Record<SchedulePriority, number> = { HIGH: 2, NORMAL: 1, LOW: 0 };

/** Most urgent first: status, then priority, then the nearest due, then name. */
export function byUrgency(
  a: { name: string; priority: SchedulePriority; due: ScheduleDue },
  b: { name: string; priority: SchedulePriority; due: ScheduleDue },
) {
  const nearest = (due: ScheduleDue, key: "days" | "km") =>
    (key === "days" ? due.date?.daysRemaining : due.distance?.kmRemaining) ?? Infinity;
  return (
    RANK[b.due.status] - RANK[a.due.status] ||
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
    nearest(a.due, "days") - nearest(b.due, "days") ||
    nearest(a.due, "km") - nearest(b.due, "km") ||
    a.name.localeCompare(b.name)
  );
}

/** The overview's one-line state from the schedules' statuses (never a health claim). */
export function overviewState(statuses: ScheduleStatus[]): MaintenanceState {
  const has = (status: ScheduleStatus) => statuses.includes(status);
  if (has(ScheduleStatus.OVERDUE)) return MaintenanceState.OVERDUE;
  if (has(ScheduleStatus.DUE)) return MaintenanceState.ATTENTION;
  if (has(ScheduleStatus.DUE_SOON) || has(ScheduleStatus.UPCOMING))
    return MaintenanceState.UPCOMING;
  if (has(ScheduleStatus.UP_TO_DATE)) return MaintenanceState.ALL_CAUGHT_UP;
  return MaintenanceState.INCOMPLETE;
}
