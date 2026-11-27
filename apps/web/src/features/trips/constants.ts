import { ReportingPeriod, type SystemTripCategoryKey, type TripMethod } from "@automate/shared";

/** The trip types' colours (color-system.md "Charts"); the user's own share the neutral one. */
const TYPE_COLORS: Record<SystemTripCategoryKey, string> = {
  COMMUTE: "var(--chart-1)",
  PERSONAL: "var(--chart-2)",
  ROAD_TRIP: "var(--chart-3)",
  BUSINESS: "var(--chart-4)",
  ERRANDS: "var(--chart-5)",
  AIRPORT_RAILWAY: "var(--chart-2)",
  OTHER: "var(--muted-foreground)",
};
export const typeColor = (key: SystemTripCategoryKey | null) =>
  key ? TYPE_COLORS[key] : "var(--muted-foreground)";

export const METHOD_LABELS: Record<TripMethod, string> = {
  ODOMETER: "Odometer readings",
  DISTANCE: "Distance entered",
};

/** The periods the trips pages offer, in picker order. */
export const TRIP_PERIODS = [
  ReportingPeriod.THIS_WEEK,
  ReportingPeriod.THIS_MONTH,
  ReportingPeriod.LAST_MONTH,
  ReportingPeriod.LAST_3_MONTHS,
  ReportingPeriod.LAST_6_MONTHS,
  ReportingPeriod.THIS_YEAR,
  ReportingPeriod.CUSTOM,
  ReportingPeriod.ALL_TIME,
] as const;
export type TripPeriod = (typeof TRIP_PERIODS)[number];
