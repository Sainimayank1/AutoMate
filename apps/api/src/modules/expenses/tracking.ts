import { istToday } from "@automate/shared";

/**
 * Due dates before a schedule (or loan) is added aren't owed: they were dealt with outside
 * AutoMate, so tracking starts at the first due date, or today if that has passed.
 */
export function trackedFrom(firstDueDate: string, now: Date = new Date()): string {
  const today = istToday(now);
  return firstDueDate > today ? firstDueDate : today;
}
