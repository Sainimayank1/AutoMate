import { DashboardMetric, DashboardWidget, ReportingPeriod } from "@automate/shared";

export const PERIOD_LABELS: Record<ReportingPeriod, string> = {
  [ReportingPeriod.THIS_MONTH]: "This month",
  [ReportingPeriod.LAST_MONTH]: "Last month",
  [ReportingPeriod.LAST_3_MONTHS]: "Last 3 months",
  [ReportingPeriod.THIS_YEAR]: "This year",
  [ReportingPeriod.LAST_12_MONTHS]: "Last 12 months",
  [ReportingPeriod.CUSTOM]: "Custom range",
  [ReportingPeriod.THIS_WEEK]: "This week",
  [ReportingPeriod.LAST_6_MONTHS]: "Last 6 months",
  [ReportingPeriod.ALL_TIME]: "All time",
};

/** The sections the user can show, hide and reorder (Customise). */
export const WIDGET_LABELS: Record<DashboardWidget, string> = {
  [DashboardWidget.METRICS]: "Key figures",
  [DashboardWidget.INSIGHTS]: "Smart insights",
  [DashboardWidget.SPENDING]: "Spending",
  [DashboardWidget.FUEL]: "Fuel & mileage",
  [DashboardWidget.MAINTENANCE]: "Maintenance",
  [DashboardWidget.EXPIRIES]: "Expiry dates",
  [DashboardWidget.DRIVING]: "Driving",
  [DashboardWidget.ACTIVITY]: "Recent activity",
};

/** Small cards: consecutive ones share a row. */
export const SMALL_WIDGETS: ReadonlySet<DashboardWidget> = new Set([
  DashboardWidget.MAINTENANCE,
  DashboardWidget.EXPIRIES,
  DashboardWidget.DRIVING,
]);

export const METRIC_LABELS: Record<DashboardMetric, string> = {
  [DashboardMetric.SPENT]: "Spent",
  [DashboardMetric.RUNNING_COST_PER_KM]: "Running cost / km",
  [DashboardMetric.MILEAGE]: "Average mileage",
  [DashboardMetric.DISTANCE]: "Distance",
  [DashboardMetric.FUEL_SPEND]: "Fuel spend",
  [DashboardMetric.NEXT_EMI]: "Next EMI",
};
