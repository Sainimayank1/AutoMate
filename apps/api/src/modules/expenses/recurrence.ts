import { addDays, addMonths, PaymentState, RecurrenceUnit } from "@automate/shared";

export type Recurrence = {
  startDate: string;
  endDate: string | null;
  every: number;
  unit: RecurrenceUnit;
};

/** What was done about a due date (only acted-on dates are stored). */
export type Acted = {
  dueDate: string;
  postponedTo: string | null;
  skipped: boolean;
  expenseId: string | null;
};

/**
 * The k-th due date (k from 0). Always counted from the start, never from the previous date, so a
 * schedule starting on the 31st falls on each month's last day and comes back to the 31st.
 */
export function dueDateAt({ startDate, every, unit }: Recurrence, k: number): string {
  switch (unit) {
    case RecurrenceUnit.DAY:
      return addDays(startDate, k * every);
    case RecurrenceUnit.WEEK:
      return addDays(startDate, 7 * k * every);
    case RecurrenceUnit.MONTH:
      return addMonths(startDate, k * every);
    case RecurrenceUnit.YEAR:
      return addMonths(startDate, 12 * k * every);
  }
}

const DAY_MS = 86_400_000;
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/** A safe first k to scan from for dates on or after `from` (never past the first one). */
function firstIndexNear(schedule: Recurrence, from: string): number {
  if (from <= schedule.startDate) return 0;
  const months = monthIndex(from) - monthIndex(schedule.startDate);
  const days = (Date.parse(from) - Date.parse(schedule.startDate)) / DAY_MS;
  const steps = {
    [RecurrenceUnit.DAY]: days / schedule.every,
    [RecurrenceUnit.WEEK]: days / (7 * schedule.every),
    [RecurrenceUnit.MONTH]: months / schedule.every,
    [RecurrenceUnit.YEAR]: months / (12 * schedule.every),
  }[schedule.unit];
  return Math.max(0, Math.floor(steps) - 1);
}

/** The due dates between `from` and `to` (both included) that the schedule has. */
export function dueDates(schedule: Recurrence, from: string, to: string, limit = 500): string[] {
  const dates: string[] = [];
  const last = schedule.endDate && schedule.endDate < to ? schedule.endDate : to;
  for (let k = firstIndexNear(schedule, from); dates.length < limit; k++) {
    const date = dueDateAt(schedule, k);
    if (date > last) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

/**
 * How a due date stands today: paid (it has an expense) or skipped as recorded; otherwise from
 * when it's now due (postponed or not): overdue once past, due within the reminder window,
 * scheduled before that.
 */
export function stateOf(
  dueDate: string,
  acted: Acted | undefined,
  today: string,
  reminderDays: number,
): PaymentState {
  if (acted?.expenseId) return PaymentState.PAID;
  if (acted?.skipped) return PaymentState.SKIPPED;
  const when = acted?.postponedTo ?? dueDate;
  if (when < today) return PaymentState.OVERDUE;
  if (when <= addDays(today, reminderDays)) return PaymentState.DUE;
  return PaymentState.SCHEDULED;
}
