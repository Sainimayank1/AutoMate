import {
  ReportingPeriod,
  type SystemTripCategoryKey,
  TRIP_COST_EXPENSE,
  type TripCostCategory,
  type TripMethod,
} from "@automate/shared";

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

export const COST_LABELS: Record<TripCostCategory | "FUEL", string> = {
  FUEL: "Fuel",
  TOLL: "Toll",
  PARKING: "Parking",
  FOOD: "Food",
  ACCOMMODATION: "Accommodation",
  OTHER: "Other",
};

export const COST_COLORS: Record<TripCostCategory | "FUEL", string> = {
  FUEL: "var(--chart-1)",
  TOLL: "var(--chart-2)",
  PARKING: "var(--chart-3)",
  FOOD: "var(--chart-4)",
  ACCOMMODATION: "var(--chart-5)",
  OTHER: "var(--muted-foreground)",
};

/** Whether a cost of this kind is also one of the vehicle's expenses. */
export const isVehicleCost = (category: TripCostCategory) => !!TRIP_COST_EXPENSE[category];
