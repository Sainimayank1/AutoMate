import { z } from "zod";

import { ReportingPeriod } from "../common/periods.js";
import type { DateWindow } from "../common/periods.js";
import type { MaintenanceCategoryKey } from "./maintenance-categories.js";
import { createScheduleSchema } from "./maintenance.schema.js";

// ---- Phase 7: analytics (docs/architecture/maintenance.md)

export const MAINTENANCE_ANALYTICS_PERIODS = [
  ReportingPeriod.LAST_12_MONTHS,
  ReportingPeriod.THIS_YEAR,
  ReportingPeriod.ALL_TIME,
] as const;

/** `GET /vehicles/:vehicleId/maintenance-analytics`. */
export const maintenanceAnalyticsQuerySchema = z.object({
  period: z.enum(MAINTENANCE_ANALYTICS_PERIODS).default(ReportingPeriod.LAST_12_MONTHS),
});
export type MaintenanceAnalyticsQuery = z.output<typeof maintenanceAnalyticsQuerySchema>;

export interface MaintenanceAnalytics {
  period: DateWindow;
  /** Money as decimal strings; spending comes from Expenses (Maintenance and Repairs). */
  totals: {
    spend: string;
    maintenance: string;
    repairs: string;
    /** Service records in the window, and how many were repairs. */
    services: number;
    repairVisits: number;
    averagePerService: string | null;
    /** From odometer readings in the window; null without two readings. */
    distanceKm: number | null;
    costPerKm: string | null;
  };
  months: { month: string; maintenance: string; repairs: string }[];
  /** By Expenses subcategory, largest first. */
  categories: { name: string; total: string; percent: number }[];
  /** Gaps between consecutive service records. */
  frequency: { averageDays: number | null; averageKm: number | null; intervals: number };
  /** Parts replaced in the window: the life they reached against their estimate. */
  replacements: {
    name: string;
    replacedOn: string;
    replacedKm: number | null;
    lifeKm: number | null;
    expectedLifeKm: number | null;
    percentOfLife: number | null;
  }[];
  /** Every active vehicle of the user's over the same window (only when there's more than one). */
  comparison: {
    vehicleId: string;
    name: string;
    registrationNumber: string;
    spend: string;
    services: number;
    costPerKm: string | null;
  }[];
  /** Rule-based observations from the figures above (no AI). */
  insights: string[];
}

// ---- Phase 8: planning and templates

/** Shown wherever a template is offered or applied. */
export const TEMPLATE_CAUTION = "Generic starting point — check your owner's manual";

type TemplateItem = {
  categoryKey: MaintenanceCategoryKey;
  name: string;
  intervalKm: number | null;
  intervalMonths: number | null;
};

const item = (
  categoryKey: MaintenanceCategoryKey,
  name: string,
  intervalKm: number | null,
  intervalMonths: number | null,
): TemplateItem => ({ categoryKey, name, intervalKm, intervalMonths });

/**
 * Generic schedule templates: typical intervals for Indian conditions, a starting point the user
 * reviews and edits before anything is added (TEMPLATE_CAUTION). Not a manufacturer's schedule.
 */
export const MAINTENANCE_TEMPLATES = [
  {
    key: "PETROL_CAR",
    name: "Petrol hatchback or sedan",
    items: [
      item("GENERAL.PERIODIC_SERVICE", "Periodic service", 10_000, 12),
      item("ENGINE.ENGINE_OIL", "Engine oil & filter", 10_000, 12),
      item("ENGINE.AIR_FILTER", "Air filter", 20_000, 24),
      item("AC.CABIN_FILTER", "Cabin filter", 15_000, 12),
      item("ENGINE.SPARK_PLUGS", "Spark plugs", 40_000, 48),
      item("BRAKES.BRAKE_FLUID", "Brake fluid", 40_000, 24),
      item("COOLING.COOLANT", "Coolant", 40_000, 36),
      item("TYRES.ROTATION", "Tyre rotation", 10_000, null),
      item("TYRES.ALIGNMENT", "Wheel alignment & balancing", 10_000, 12),
    ],
  },
  {
    key: "DIESEL_SUV",
    name: "Diesel SUV",
    items: [
      item("GENERAL.PERIODIC_SERVICE", "Periodic service", 10_000, 12),
      item("ENGINE.ENGINE_OIL", "Engine oil & filter", 10_000, 12),
      item("ENGINE.AIR_FILTER", "Air filter", 20_000, 24),
      item("OTHER.OTHER", "Fuel filter", 20_000, 24),
      item("AC.CABIN_FILTER", "Cabin filter", 15_000, 12),
      item("BRAKES.BRAKE_FLUID", "Brake fluid", 40_000, 24),
      item("COOLING.COOLANT", "Coolant", 40_000, 36),
      item("TYRES.ROTATION", "Tyre rotation", 10_000, null),
      item("TYRES.ALIGNMENT", "Wheel alignment & balancing", 10_000, 12),
    ],
  },
  {
    key: "CNG_CAR",
    name: "CNG car",
    items: [
      item("GENERAL.PERIODIC_SERVICE", "Periodic service", 10_000, 12),
      item("ENGINE.ENGINE_OIL", "Engine oil & filter", 10_000, 12),
      item("GENERAL.INSPECTION", "CNG kit check", 10_000, 6),
      item("ENGINE.SPARK_PLUGS", "Spark plugs", 20_000, 24),
      item("ENGINE.AIR_FILTER", "Air filter", 20_000, 24),
      item("BRAKES.BRAKE_FLUID", "Brake fluid", 40_000, 24),
      item("TYRES.ALIGNMENT", "Wheel alignment & balancing", 10_000, 12),
    ],
  },
  {
    key: "ELECTRIC_CAR",
    name: "Electric car",
    items: [
      item("GENERAL.PERIODIC_SERVICE", "Periodic check-up", 15_000, 12),
      item("AC.CABIN_FILTER", "Cabin filter", 15_000, 12),
      item("BRAKES.BRAKE_FLUID", "Brake fluid", 40_000, 24),
      item("COOLING.COOLANT", "Battery coolant check", null, 24),
      item("ELECTRICAL.BATTERY_INSPECTION", "12V battery check", null, 6),
      item("TYRES.ROTATION", "Tyre rotation", 10_000, null),
      item("TYRES.ALIGNMENT", "Wheel alignment & balancing", 10_000, 12),
    ],
  },
  {
    key: "TWO_WHEELER",
    name: "Two-wheeler",
    items: [
      item("GENERAL.PERIODIC_SERVICE", "Periodic service", 3_000, 6),
      item("ENGINE.ENGINE_OIL", "Engine oil", 3_000, 6),
      item("ENGINE.AIR_FILTER", "Air filter", 12_000, 12),
      item("ENGINE.SPARK_PLUGS", "Spark plug", 10_000, 12),
      item("TRANSMISSION.INSPECTION", "Chain clean & adjust", 1_000, 1),
      item("BRAKES.INSPECTION", "Brake check", 5_000, 6),
    ],
  },
] as const satisfies readonly { key: string; name: string; items: readonly TemplateItem[] }[];

export type MaintenanceTemplateKey = (typeof MAINTENANCE_TEMPLATES)[number]["key"];

export const MAX_SCHEDULES_AT_ONCE = 20;

/** `POST /vehicles/:vehicleId/maintenance-schedules/bulk`: a reviewed template, all or nothing. */
export const bulkCreateSchedulesSchema = z.object({
  schedules: z
    .array(createScheduleSchema)
    .min(1, "Choose at least one schedule")
    .max(MAX_SCHEDULES_AT_ONCE, `Up to ${MAX_SCHEDULES_AT_ONCE} at once`),
});
export type BulkCreateSchedulesValues = z.output<typeof bulkCreateSchedulesSchema>;

/** `GET /vehicles/:vehicleId/maintenance-plan`: the open one-time jobs and what they should cost. */
export interface MaintenancePlanSummary {
  /** One-time jobs not yet done (paused ones excluded). */
  open: number;
  /** Sum of their estimates (decimal string): an estimate, never spend. */
  estimatedTotal: string;
  /** Open jobs with no estimate, so the total says what it leaves out. */
  withoutEstimate: number;
}
