import { ReportingPeriod } from "@automate/shared";

export const PERIOD_LABELS: Record<ReportingPeriod, string> = {
  [ReportingPeriod.THIS_MONTH]: "This month",
  [ReportingPeriod.LAST_MONTH]: "Last month",
  [ReportingPeriod.LAST_3_MONTHS]: "Last 3 months",
  [ReportingPeriod.THIS_YEAR]: "This year",
  [ReportingPeriod.LAST_12_MONTHS]: "Last 12 months",
  [ReportingPeriod.CUSTOM]: "Custom range",
};

/** "Good morning" until noon, "Good afternoon" until 5 pm, then "Good evening" (the device's clock). */
export function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
