import { type MaintenanceSchedule, ScheduleStatus, type StatusItem } from "@automate/shared";

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const kmFormat = new Intl.NumberFormat("en-IN");
const day = (iso: string) => dayFormat.format(new Date(`${iso}T00:00:00.000Z`));
const km = (value: number) => `${kmFormat.format(value)} km`;
const inDays = (days: number) =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${kmFormat.format(days)} days`;
const daysOverdue = (days: number) => (days === 1 ? "1 day" : `${kmFormat.format(days)} days`);

/** Not tracked: paused, done (one-time) or unconfigured schedules don't watch anything. */
const WATCHING: ScheduleStatus[] = [
  ScheduleStatus.OVERDUE,
  ScheduleStatus.DUE,
  ScheduleStatus.DUE_SOON,
  ScheduleStatus.UPCOMING,
  ScheduleStatus.UP_TO_DATE,
];

/**
 * Maintenance for the dashboard's status panel (docs/architecture/dashboard.md §6): overdue
 * schedules are critical, due and due-soon ones warnings, by whichever of date or distance comes
 * first. `tracked` only when the vehicle has an active schedule: with none, nothing is watched, so
 * the panel must not read "nothing due".
 */
export function maintenanceStatus(schedules: MaintenanceSchedule[]): {
  items: StatusItem[];
  tracked: boolean;
} {
  const items = schedules.flatMap((schedule): StatusItem[] => {
    const { status, decidedBy, date, distance } = schedule.due;
    const overdue = status === ScheduleStatus.OVERDUE;
    if (!overdue && status !== ScheduleStatus.DUE && status !== ScheduleStatus.DUE_SOON) return [];
    const byDistance = decidedBy === "DISTANCE" && distance;
    const title = overdue
      ? byDistance
        ? `${schedule.name} is ${km(-distance.kmRemaining)} overdue`
        : `${schedule.name} is ${daysOverdue(-date!.daysRemaining)} overdue`
      : byDistance
        ? `${schedule.name} due ${distance.kmRemaining === 0 ? "now" : `in ${km(distance.kmRemaining)}`}`
        : `${schedule.name} due ${inDays(date!.daysRemaining)}`;
    const dues = [distance && `at ${km(distance.nextDueKm)}`, date && `on ${day(date.nextDue)}`];
    const [first, second] = byDistance ? dues : [dues[1], dues[0]];
    const detail = [first, second].filter(Boolean).join(" or ");
    return [
      {
        id: `maintenance:${schedule.id}`,
        severity: overdue ? "critical" : "warning",
        title,
        detail: `Due ${detail}${first && second ? ", whichever comes first" : ""}`,
        href: `/maintenance/schedules/${schedule.id}`,
      },
    ];
  });
  return { items, tracked: schedules.some((schedule) => WATCHING.includes(schedule.due.status)) };
}
