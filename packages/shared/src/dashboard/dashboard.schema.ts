import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";

import { checkPeriodQuery, type PeriodWindow, periodQueryFields } from "../common/periods.js";
import type { SpendGroup } from "../expenses/expense-categories.js";
import type { ExpenseCategoryRef } from "../expenses/expense.schema.js";
import type { MileagePoint } from "../fuel/fuel.schema.js";
import type {
  MaintenanceSchedule,
  MaintenanceState,
  ServiceRecord,
} from "../maintenance/maintenance.schema.js";
import type { FuelType, Vehicle } from "../vehicles/vehicle.schema.js";

/** `GET /dashboard/overview`: one vehicle and a period (custom needs both dates). */
export const dashboardOverviewQuerySchema = z
  .object({ vehicleId: z.uuid("Choose a vehicle"), ...periodQueryFields })
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
export type ItemSource = "maintenance" | "insurance" | "warranty";

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

/** The five core metrics (docs/architecture/dashboard.md §1). */
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
  id: "insurance" | "warranty";
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
}

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
 * (Expenses) and service records (Maintenance). A service's own expense isn't listed twice.
 */
export interface ActivityItem {
  /** "expense:<id>" or "service:<id>" */
  id: string;
  kind: "fuel" | "expense" | "refund" | "service";
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
