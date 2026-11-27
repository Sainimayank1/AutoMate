import type { MaintenanceSchedule, ScheduleDue } from "@automate/shared";

import { formatDate, formatDistance, formatNumber } from "@/utils/format";

/** Words for the API's due figures; no due maths here (the API computes every figure). */

const plural = (count: number, unit: string) =>
  `${formatNumber(count)} ${unit}${count === 1 ? "" : "s"}`;

/** The API's signed figures as words: never a negative number shown as if it were positive. */
function dateText({ nextDue, daysRemaining }: NonNullable<ScheduleDue["date"]>) {
  if (daysRemaining > 0)
    return `Due on ${formatDate(nextDue)} · ${plural(daysRemaining, "day")} left`;
  if (daysRemaining === 0) return `Due today (${formatDate(nextDue)})`;
  return `${plural(-daysRemaining, "day")} overdue · was due ${formatDate(nextDue)}`;
}

function distanceText({ nextDueKm, kmRemaining }: NonNullable<ScheduleDue["distance"]>) {
  if (kmRemaining > 0)
    return `Due at ${formatDistance(nextDueKm)} · ${formatDistance(kmRemaining)} left`;
  if (kmRemaining === 0) return `Due now at ${formatDistance(nextDueKm)}`;
  return `${formatDistance(-kmRemaining)} overdue · was due at ${formatDistance(nextDueKm)}`;
}

/** "Every 10,000 km or 12 months", "Once at 7,250 km", "Once on 15/12/2026". */
export function intervalText(schedule: MaintenanceSchedule): string {
  const { intervalKm, intervalMonths, dueDate, dueKm } = schedule;
  if (intervalKm != null || intervalMonths != null) {
    const parts = [
      intervalKm != null && formatDistance(intervalKm),
      intervalMonths != null && plural(intervalMonths, "month"),
    ].filter(Boolean);
    return `Every ${parts.join(" or ")}`;
  }
  const parts = [
    dueKm != null && `at ${formatDistance(dueKm)}`,
    dueDate && `on ${formatDate(dueDate)}`,
  ];
  return `Once ${parts.filter(Boolean).join(" or ")}`;
}

/** What the schedule counts from: the user's last done, or when it was added. */
export function basisText(schedule: MaintenanceSchedule): string {
  const { lastDoneDate, lastDoneKm, intervalKm, intervalMonths, addedOdometerKm, createdAt } =
    schedule;
  if (intervalKm == null && intervalMonths == null) return `Added ${formatDate(createdAt)}`;
  if (lastDoneDate || lastDoneKm != null) {
    const parts = [
      lastDoneDate && formatDate(lastDoneDate),
      lastDoneKm != null && formatDistance(lastDoneKm),
    ];
    return `Last done ${parts.filter(Boolean).join(" · ")}`;
  }
  return `Counting from ${formatDate(createdAt)} · ${formatDistance(addedOdometerKm)} (when added)`;
}

/** The deciding track first (whichever comes first), then the other. */
export function dueLines(due: ScheduleDue): string[] {
  const date = due.date && dateText(due.date);
  const distance = due.distance && distanceText(due.distance);
  const lines = due.decidedBy === "DISTANCE" ? [distance, date] : [date, distance];
  return lines.filter((line): line is string => !!line);
}

/** "1,200 km overdue" or "18 days overdue": the deciding track of an overdue schedule. */
export function overdueBy(due: ScheduleDue): string {
  if (due.decidedBy === "DISTANCE" && due.distance) {
    return `${formatDistance(-due.distance.kmRemaining)} overdue`;
  }
  return due.date ? `${plural(-due.date.daysRemaining, "day")} overdue` : "Overdue";
}

/** "in 1,550 km or 107 days" for the next service, deciding track first. */
export function dueShort(due: ScheduleDue): string {
  const date =
    due.date && due.date.daysRemaining >= 0 ? plural(due.date.daysRemaining, "day") : null;
  const distance =
    due.distance && due.distance.kmRemaining >= 0 ? formatDistance(due.distance.kmRemaining) : null;
  const parts = due.decidedBy === "DISTANCE" ? [distance, date] : [date, distance];
  const shown = parts.filter(Boolean);
  return shown.length ? `in ${shown.join(" or ")}` : "Due now";
}

/** How far through its interval the deciding track is (repeating schedules only). */
export function progressOf(schedule: MaintenanceSchedule): number | null {
  const { due, intervalKm, intervalMonths } = schedule;
  if (due.decidedBy === "DISTANCE" && due.distance && intervalKm) {
    return 1 - due.distance.kmRemaining / intervalKm;
  }
  if (due.decidedBy === "DATE" && due.date?.from && intervalMonths) {
    const total = Date.parse(due.date.nextDue) - Date.parse(due.date.from);
    return total > 0 ? 1 - (due.date.daysRemaining * 86_400_000) / total : null;
  }
  return null;
}
