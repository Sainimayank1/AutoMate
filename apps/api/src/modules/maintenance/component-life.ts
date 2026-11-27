import {
  addMonths,
  type ComponentCondition,
  type ComponentLife,
  type ComponentState,
  ComponentStatus,
  LIFE_NOTICE,
  ScheduleStatus,
} from "@automate/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/** Whole calendar months from one date to another (never negative). */
function monthsBetween(from: string, to: string) {
  const [y1, m1, d1] = from.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split("-").map(Number) as [number, number, number];
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

type Part = {
  installedAt: string | null;
  installedKm: number | null;
  expectedLifeKm: number | null;
  expectedLifeMonths: number | null;
};

/**
 * Estimated life from the lifespan the user set (docs/architecture/maintenance.md §3b), as of a
 * point: today and the current odometer for a fitted part, the removal for one taken off. An
 * estimate only; null without a lifespan and the matching install point.
 */
export function componentLife(
  part: Part,
  odometerKm: number | null,
  today: string,
): ComponentLife | null {
  const byKm = part.expectedLifeKm != null && part.installedKm != null && odometerKm != null;
  const byTime = part.expectedLifeMonths != null && part.installedAt != null;
  if (!byKm && !byTime) return null;
  let kmFraction = -1;
  let timeFraction = -1;
  const life: ComponentLife = {
    kmUsed: null,
    kmRemaining: null,
    estimatedKm: null,
    monthsUsed: null,
    daysRemaining: null,
    estimatedDate: null,
    fractionUsed: 0,
    decidedBy: "DISTANCE",
  };
  if (byKm) {
    life.kmUsed = Math.max(0, odometerKm - part.installedKm!);
    life.estimatedKm = part.installedKm! + part.expectedLifeKm!;
    life.kmRemaining = life.estimatedKm - odometerKm;
    kmFraction = life.kmUsed / part.expectedLifeKm!;
  }
  if (byTime) {
    life.estimatedDate = addMonths(part.installedAt!, part.expectedLifeMonths!);
    life.monthsUsed = monthsBetween(part.installedAt!, today);
    life.daysRemaining = daysBetween(today, life.estimatedDate);
    const total = daysBetween(part.installedAt!, life.estimatedDate);
    timeFraction = Math.max(0, daysBetween(part.installedAt!, today)) / total;
  }
  life.decidedBy = timeFraction > kmFraction ? "TIME" : "DISTANCE";
  life.fractionUsed = Math.round(Math.max(kmFraction, timeFraction) * 1000) / 1000;
  return life;
}

/** Under warranty by date and km (whichever ends first); null without a warranty. */
export function warrantyActive(
  part: { warrantyUntil: string | null; warrantyKm: number | null },
  odometerKm: number,
  today: string,
): boolean | null {
  if (!part.warrantyUntil && part.warrantyKm == null) return null;
  return (
    (!part.warrantyUntil || today <= part.warrantyUntil) &&
    (part.warrantyKm == null || odometerKm <= part.warrantyKm)
  );
}

const WATCH_DUE: ScheduleStatus[] = [
  ScheduleStatus.OVERDUE,
  ScheduleStatus.DUE,
  ScheduleStatus.DUE_SOON,
];

/**
 * A part's status, most telling first: taken off, failed, near the end of its estimated life (or
 * marked "replace soon"), a watching schedule due, then the condition the user recorded.
 */
export function componentStatus(
  part: { state: ComponentState; condition: ComponentCondition },
  life: ComponentLife | null,
  schedules: ScheduleStatus[],
): ComponentStatus {
  if (part.state === "REPLACED") return ComponentStatus.REPLACED;
  if (part.state === "REMOVED") return ComponentStatus.REMOVED;
  if (part.condition === "FAILED") return ComponentStatus.FAILED;
  if (part.condition === "REPLACE_SOON" || (life && life.fractionUsed >= LIFE_NOTICE)) {
    return ComponentStatus.REPLACEMENT_APPROACHING;
  }
  if (schedules.some((status) => WATCH_DUE.includes(status))) return ComponentStatus.INSPECTION_DUE;
  if (part.condition === "MONITORING" || part.condition === "NEEDS_ATTENTION") {
    return ComponentStatus.MONITORING;
  }
  if (part.condition === "NEW") return ComponentStatus.NEW;
  if (part.condition === "GOOD") return ComponentStatus.GOOD;
  return ComponentStatus.UNKNOWN;
}
