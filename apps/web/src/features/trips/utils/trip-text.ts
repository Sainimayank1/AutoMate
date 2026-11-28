import { tripProgress } from "@automate/shared";

/** "4h 12m", "45m", "26h 5m": driving time, never a day count. */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? (rest ? `${hours}h ${rest}m` : `${hours}h`) : `${rest}m`;
}

/** "today", "tomorrow", "in 16 days", "3 days ago": a plan's departure from today (ISO dates). */
export function countdownText(date: string, today: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** A plan's timing: "Day 2 of 4" while it's on, else the countdown to departure. */
export function planTimingText(date: string, endDate: string | null, today: string): string {
  const progress = tripProgress(date, endDate, today);
  return progress.state === "in_progress" && progress.of > 1
    ? `Day ${progress.day} of ${progress.of}`
    : countdownText(date, today);
}
