import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";

import {
  checkPeriodQuery,
  type DateWindow,
  type PeriodWindow,
  periodQueryFields,
  ReportingPeriod,
} from "../common/periods.js";
import type { SpendGroup } from "../expenses/expense-categories.js";
import type { ExpenseCategoryRef } from "../expenses/expense.schema.js";
import type { PaymentState } from "../expenses/recurring.schema.js";
import type { MileagePoint } from "../fuel/fuel.schema.js";
import type {
  MaintenanceSchedule,
  MaintenanceState,
  ServiceRecord,
} from "../maintenance/maintenance.schema.js";
import type { SystemTripCategoryKey } from "../trips/trip.schema.js";
import type { FuelType, Vehicle } from "../vehicles/vehicle.schema.js";

/**
 * The periods the dashboard offers: each has a like-for-like comparison window. Others in
 * `ReportingPeriod` (e.g. all time) belong to other modules.
 */
export const DASHBOARD_PERIODS = [
  ReportingPeriod.THIS_MONTH,
  ReportingPeriod.LAST_MONTH,
  ReportingPeriod.LAST_3_MONTHS,
  ReportingPeriod.THIS_YEAR,
  ReportingPeriod.LAST_12_MONTHS,
  ReportingPeriod.CUSTOM,
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** `GET /dashboard/overview`: one vehicle and a period (custom needs both dates). */
export const dashboardOverviewQuerySchema = z
  .object({
    vehicleId: z.uuid("Choose a vehicle"),
    ...periodQueryFields,
    period: z.enum(DASHBOARD_PERIODS).default(ReportingPeriod.THIS_MONTH),
  })
  .superRefine(checkPeriodQuery);
export type DashboardOverviewQuery = z.output<typeof dashboardOverviewQuerySchema>;

/**
 * One dashboard section. Each is computed on its own: one that fails comes back as `error` and the
 * rest still show; `empty` means there's nothing recorded for it yet.
 */
export type DashboardSection<T> =
  { state: "ok"; data: T } | { state: "empty" } | { state: "error"; message: string };

export type StatusSeverity = "critical" | "warning" | "info";

/** Something about the vehicle worth knowing, from a record the user keeps. */
export interface StatusItem {
  /** Stable per source, e.g. "insurance", "warranty". */
  id: string;
  severity: StatusSeverity;
  /** "Insurance expires in 24 days" */
  title: string;
  /** Where the fact comes from, e.g. "From your insurance payment of 18 Aug 2026". */
  detail: string | null;
  /** Where to see or fix it. */
  href: string | null;
}

/** Where an action-centre item comes from (Documents, EMI and reminders join later). */
/** `payment`: a recurring payment or loan EMI due or overdue (Expenses). */
/** `reminder`: one of the user's own reminders, due or overdue (Notifications). */
export type ItemSource =
  "maintenance" | "insurance" | "warranty" | "payment" | "document" | "reminder";

/** How soon: overdue (or expired), due today, due soon, or just worth knowing. */
export type DueState = "overdue" | "due_today" | "due_soon" | "info";

/** A status item in the action centre: its state, source and the one action that fits. */
export interface ActionItem extends StatusItem {
  source: ItemSource;
  state: DueState;
  /** "Log service", "Add renewal"; null when there's nothing to do. */
  action: { label: string; href: string } | null;
}

/** What AutoMate can't see yet: while anything is untracked it never says the car is fine. */
export type UntrackedArea = "maintenance" | "documents";

export interface VehicleStatus {
  /**
   * `attention`: something is due, expiring or expired. Otherwise `incomplete` while an area is
   * untracked, and only then `no_issues` ("No issues recorded", never "healthy").
   */
  level: "attention" | "incomplete" | "no_issues";
  /** The action centre: most urgent first, each opening its record. */
  items: ActionItem[];
  untracked: UntrackedArea[];
}

/** A figure for the period and the window it's compared with (decimal strings). */
export interface MetricFigure {
  value: string | null;
  /** null when the earlier window has nothing to compare with. */
  previous: string | null;
  change: string | null;
  /** Whole percent; null when either side is missing or the earlier one is 0. */
  changePercent: number | null;
}

/** The five core metrics (docs/architecture/dashboard.md §1), and the next EMI. */
export interface DashboardMetrics {
  /** Everything paid, net of refunds, loan principal excluded. `records`: rows in the period. */
  spent: MetricFigure & { records: number };
  /** Running cost ÷ km from odometer readings. */
  runningCostPerKm: MetricFigure;
  /** From the full-tank engine; `cycles` it rests on. */
  mileage: MetricFigure & { unit: "km/L" | "km/kg" | "km/kWh"; cycles: number };
  /** From odometer readings (fill-ups and expenses), whole km. */
  distance: MetricFigure & { readings: number };
  /** The Fuel category, net of refunds; `quantity` of the primary fuel. */
  fuelSpend: MetricFigure & { quantity: string; unit: "L" | "kg" | "kWh" };
  /** The vehicle's next loan EMI, overdue first, whatever the period; null without a loan. */
  nextEmi: {
    loanId: string;
    /** When it's due (a postponed EMI's new date). */
    date: string;
    amount: string;
    state: PaymentState;
    number: number;
    of: number;
  } | null;
}

/** Spending in the period and the months around it (net, loan principal excluded). */
export interface SpendingOverview {
  /** The period's total: the same figure as `metrics.spent`. */
  total: string;
  /** The period by top-level category, largest first (only categories with net spending). */
  categories: { category: ExpenseCategoryRef; amount: string; percent: number }[];
  /** The last 6 IST months (up to 12 for longer periods) ending with the period's last month. */
  months: { month: string; total: string; groups: Record<SpendGroup, string> }[];
}

/** The period's fuel, from the full-tank engine and the fill-ups (the vehicle's primary fuel). */
export interface FuelOverview {
  fuelType: FuelType;
  unit: "L" | "kg" | "kWh";
  mileageUnit: "km/L" | "km/kg" | "km/kWh";
  /** Over the full-tank cycles that closed in the period; `cycles` it rests on. */
  averageMileage: string | null;
  cycles: number;
  /** The latest cycle up to the period's end. */
  latestMileage: MileagePoint | null;
  /** Bought in the period. */
  quantity: string;
  /** The Fuel category, net of refunds (same as `metrics.fuelSpend`). */
  spend: string;
  /** Per unit, over the period's fill-ups. */
  averagePrice: string | null;
  /** Fuel cost ÷ km over the period's full-tank cycles. */
  costPerKm: string | null;
  /** Up to the 12 latest cycles that closed by the period's end, oldest first. */
  trend: MileagePoint[];
}

/** The maintenance card, from the Maintenance module (its own due rules: time or distance). */
export interface DashboardMaintenance {
  state: MaintenanceState;
  /** Overdue schedules, and due or due soon ones. */
  overdue: number;
  dueSoon: number;
  /** Overdue first, then the next due ones; at most 4. */
  schedules: MaintenanceSchedule[];
  /** The latest service record. */
  lastService: ServiceRecord | null;
}

/** One expiry date on record (Documents will add PUC, registration and the licence). */
export interface ExpiryItem {
  /** "document:<id>"; "insurance" and "warranty" are the interim sources (a payment, the vehicle). */
  id: string;
  label: string;
  state: "valid" | "expiring" | "expired" | "not_added";
  /** "Expires in 24 days", "Valid until 14 Mar 2028 or 1,00,000 km" */
  summary: string;
  /** Where the date comes from, or what to do. */
  detail: string | null;
  href: string | null;
}

/** Driving in the period, from odometer readings (trips aren't tracked yet). */
export interface DrivingOverview {
  /** Null with fewer than two readings to measure between. */
  distanceKm: number | null;
  /** Readings in the period. */
  readings: number;
  /** Km per day over the period so far. */
  perDay: string | null;
  /** The latest reading on record by the period's end. */
  lastReading: { km: number; date: string } | null;
  /** Trips in the period (Trips); their distance is kept apart from the odometer's. */
  trips: DrivingTrips | null;
}

/** Null until the vehicle has a trip or a plan; a period without trips shows `count: 0`. */
export interface DrivingTrips {
  count: number;
  distanceKm: string;
  averageKm: string | null;
  longestKm: string | null;
  /** Most distance first. */
  byCategory: { key: SystemTripCategoryKey | null; name: string; distanceKm: string }[];
  /** The vehicle's next planned trip (or the one under way); estimates only. */
  nextPlan: {
    id: string;
    label: string;
    date: string;
    endDate: string | null;
    plannedDistanceKm: string | null;
    budget: string | null;
  } | null;
}

/**
 * The dashboard for one vehicle and period (docs/architecture/dashboard.md). Every figure comes
 * from the module that owns it.
 */
export interface DashboardOverview {
  vehicle: Vehicle;
  period: PeriodWindow;
  status: DashboardSection<VehicleStatus>;
  metrics: DashboardSection<DashboardMetrics>;
  spending: DashboardSection<SpendingOverview>;
  fuel: DashboardSection<FuelOverview>;
  maintenance: DashboardSection<DashboardMaintenance>;
  expiries: DashboardSection<ExpiryItem[]>;
  driving: DashboardSection<DrivingOverview>;
  insights: DashboardSection<DashboardInsights>;
}

// ---- smart insights (deterministic rules over the vehicle's own records, never AI)

/** What an insight is about; the dashboard shows at most one per topic. */
export type InsightTopic = "spending" | "fuel" | "usage" | "maintenance";
/** `negative`: it costs more or runs worse; `positive`: the reverse; `neutral`: neither. */
export type InsightTone = "negative" | "positive" | "neutral";
/** How far the figures behind it can be trusted, where that varies (fuel cycles, readings). */
export type InsightConfidence = "high" | "medium" | "low";

/** A notable change in the vehicle's records. */
export interface Insight {
  /** The rule that found it. */
  id: string;
  topic: InsightTopic;
  tone: InsightTone;
  title: string;
  explanation: string;
  /** The figure it rests on and the one it's compared with, formatted. */
  metric: { label: string; value: string; previous: string | null };
  /** The window compared with; null for a run of records (the last 3 full tanks, 3 months). */
  comparedWith: DateWindow | null;
  confidence: InsightConfidence | null;
  action: { label: string; href: string };
}

/** Records some insights still need, in this period and the one it's compared with. */
export type InsightNeed = "expenses" | "fuel_cycles" | "odometer";

export interface DashboardInsights {
  /** Costs and worse running first, then improvements, then the rest; at most `INSIGHT_LIMIT`. */
  items: Insight[];
  needs: InsightNeed[];
}

export const INSIGHT_LIMIT = 4;

// ---- recent activity (`GET /dashboard/activity`)

/** One vehicle's activity, a page at a time. */
export const dashboardActivityQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle"),
});
export type DashboardActivityQuery = z.output<typeof dashboardActivityQuerySchema>;

/** How far back the dashboard's feed goes; older records are in each module. */
export const ACTIVITY_DEPTH = 96;

/**
 * Something that happened to the vehicle, from the module that owns it: fill-ups and expenses
 * (Expenses), service records (Maintenance) and trips. A service's own expense isn't listed twice.
 */
export interface ActivityItem {
  /** "expense:<id>", "service:<id>", "trip:<id>" or "document:<id>" */
  id: string;
  kind: "fuel" | "expense" | "refund" | "service" | "trip" | "document";
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** "32.4 L at ₹104.32/L", "Daily usage · Toll", "Maruti Arena Service, Gurugram" */
  detail: string | null;
  /** Always positive; a refund brings money back. */
  amount: string | null;
  odometerKm: number | null;
  /** The record it opens. */
  href: string;
}

// ---- customisation (`GET/PUT /dashboard/layout`), saved per user

/**
 * Sections the user can show, hide and reorder. The greeting, the vehicle hero and the status
 * panel (it carries overdue obligations) are fixed.
 */
export const DashboardWidget = {
  METRICS: "metrics",
  INSIGHTS: "insights",
  SPENDING: "spending",
  FUEL: "fuel",
  MAINTENANCE: "maintenance",
  EXPIRIES: "expiries",
  DRIVING: "driving",
  ACTIVITY: "activity",
} as const;
export type DashboardWidget = (typeof DashboardWidget)[keyof typeof DashboardWidget];

/** The key figures the user can choose from (keys of `DashboardMetrics`), in their fixed order. */
export const DashboardMetric = {
  SPENT: "spent",
  RUNNING_COST_PER_KM: "runningCostPerKm",
  MILEAGE: "mileage",
  DISTANCE: "distance",
  FUEL_SPEND: "fuelSpend",
  NEXT_EMI: "nextEmi",
} as const satisfies Record<string, keyof DashboardMetrics>;
export type DashboardMetric = (typeof DashboardMetric)[keyof typeof DashboardMetric];

const WIDGETS = Object.values(DashboardWidget);
const METRICS = Object.values(DashboardMetric);
const distinct = (values: string[]) => new Set(values).size === values.length;

/** The whole layout: every section once, in order, and at least one key figure. */
export const dashboardLayoutSchema = z.object({
  widgets: z
    .array(z.object({ id: z.enum(DashboardWidget), visible: z.boolean() }))
    .refine(
      (widgets) => widgets.length === WIDGETS.length && distinct(widgets.map((w) => w.id)),
      "List every section once",
    ),
  metrics: z
    .array(z.enum(DashboardMetric))
    .min(1, "Choose at least one key figure")
    .refine(distinct, "Choose each key figure once"),
});
export type DashboardLayout = z.output<typeof dashboardLayoutSchema>;

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: WIDGETS.map((id) => ({ id, visible: true })),
  metrics: METRICS,
};

const isWidget = (value: unknown): value is DashboardWidget =>
  (WIDGETS as unknown[]).includes(value);
const isMetric = (value: unknown): value is DashboardMetric =>
  (METRICS as unknown[]).includes(value);

/**
 * A saved layout made current: sections that no longer exist are dropped, and new ones are added,
 * shown, where the default has them (after the section they follow); key figures keep their fixed
 * order, and none chosen means all.
 */
export function normalizeDashboardLayout(saved: unknown): DashboardLayout {
  const value = (saved ?? {}) as { widgets?: unknown; metrics?: unknown };
  const widgets: DashboardLayout["widgets"] = [];
  for (const item of Array.isArray(value.widgets) ? value.widgets : []) {
    const { id, visible } = (item ?? {}) as { id?: unknown; visible?: unknown };
    if (isWidget(id) && !widgets.some((widget) => widget.id === id)) {
      widgets.push({ id, visible: visible !== false });
    }
  }
  WIDGETS.forEach((id, index) => {
    if (widgets.some((widget) => widget.id === id)) return;
    const after = widgets.findIndex((widget) => widget.id === WIDGETS[index - 1]);
    widgets.splice(after + 1, 0, { id, visible: true });
  });
  const chosen = Array.isArray(value.metrics) ? value.metrics.filter(isMetric) : [];
  return {
    widgets,
    metrics: chosen.length ? METRICS.filter((metric) => chosen.includes(metric)) : METRICS,
  };
}

/**
 * `POST /dashboard/dismissals`: hide an information-only action-centre item (severity `info`) for
 * that vehicle. Items that need doing can't be dismissed: they go when they're done.
 */
export const dismissDashboardItemSchema = z.object({
  vehicleId: z.uuid(),
  itemId: z.string().trim().min(1).max(120),
});
export type DismissDashboardItemValues = z.output<typeof dismissDashboardItemSchema>;
