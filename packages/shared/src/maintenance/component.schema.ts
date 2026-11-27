import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  blankToNull,
  latestAllowedDate,
  optionalDate,
  optionalDecimal,
  optionalInt,
  optionalText,
} from "../common/fields.js";
import { PaymentMethod } from "../common/payment-method.js";
import { ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";
import type { MaintenanceCategoryKey } from "./maintenance-categories.js";
import type { InspectionCondition } from "./inspection.schema.js";
import type { MaintenanceProvider, ScheduleStatus } from "./maintenance.schema.js";

/** Component lifecycle contract (module 5 B). Rules: docs/architecture/maintenance.md. */

/** What can be tracked: key, name, and the maintenance work a replacement is logged as. */
export const COMPONENT_KINDS = [
  ["BATTERY", "12V battery", "ELECTRICAL.BATTERY_REPLACEMENT"],
  ["TYRES", "Tyres", "TYRES.REPLACEMENT"],
  ["BRAKE_PADS", "Brake pads", "BRAKES.BRAKE_PADS"],
  ["BRAKE_DISCS", "Brake discs", "BRAKES.BRAKE_DISCS"],
  ["ENGINE_OIL", "Engine oil", "ENGINE.ENGINE_OIL"],
  ["OIL_FILTER", "Oil filter", "ENGINE.OIL_FILTER"],
  ["AIR_FILTER", "Air filter", "ENGINE.AIR_FILTER"],
  ["CABIN_FILTER", "Cabin filter", "AC.CABIN_FILTER"],
  ["SPARK_PLUGS", "Spark plugs", "ENGINE.SPARK_PLUGS"],
  ["COOLANT", "Coolant", "COOLING.COOLANT"],
  ["TIMING_BELT", "Timing belt", "ENGINE.TIMING_BELT"],
  ["CLUTCH", "Clutch", "TRANSMISSION.CLUTCH_REPLACEMENT"],
  ["WIPER_BLADES", "Wiper blades", "OTHER.OTHER"],
  ["SHOCK_ABSORBERS", "Shock absorbers", "SUSPENSION.SHOCK_ABSORBERS"],
  ["OTHER", "Other", "OTHER.OTHER"],
] as const satisfies readonly (readonly [string, string, MaintenanceCategoryKey])[];

export type ComponentKind = (typeof COMPONENT_KINDS)[number][0];
export const COMPONENT_KIND_KEYS = COMPONENT_KINDS.map(([key]) => key) as [
  ComponentKind,
  ...ComponentKind[],
];
const kindRow = (kind: string) => COMPONENT_KINDS.find(([key]) => key === kind);
export const componentKindName = (kind: string) => kindRow(kind)?.[1] ?? "Other";
/** The maintenance category a replacement of this kind is logged under. */
export const componentKindCategory = (kind: string): MaintenanceCategoryKey =>
  kindRow(kind)?.[2] ?? "OTHER.OTHER";

/** The user's own reading of a part (set by inspections). */
export const ComponentCondition = {
  NEW: "NEW",
  GOOD: "GOOD",
  MONITORING: "MONITORING",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  REPLACE_SOON: "REPLACE_SOON",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
} as const;
export type ComponentCondition = (typeof ComponentCondition)[keyof typeof ComponentCondition];

/** Where the part is: still fitted, or taken off (history kept either way). */
export const ComponentState = {
  INSTALLED: "INSTALLED",
  REPLACED: "REPLACED",
  REMOVED: "REMOVED",
} as const;
export type ComponentState = (typeof ComponentState)[keyof typeof ComponentState];

/** Computed on read from state, condition, estimated life and linked schedules. */
export const ComponentStatus = {
  NEW: "NEW",
  GOOD: "GOOD",
  MONITORING: "MONITORING",
  INSPECTION_DUE: "INSPECTION_DUE",
  REPLACEMENT_APPROACHING: "REPLACEMENT_APPROACHING",
  REPLACED: "REPLACED",
  FAILED: "FAILED",
  REMOVED: "REMOVED",
  UNKNOWN: "UNKNOWN",
} as const;
export type ComponentStatus = (typeof ComponentStatus)[keyof typeof ComponentStatus];

export const ComponentEventType = {
  INSTALLED: "INSTALLED",
  INSPECTED: "INSPECTED",
  REPLACED: "REPLACED",
  REMOVED: "REMOVED",
} as const;
export type ComponentEventType = (typeof ComponentEventType)[keyof typeof ComponentEventType];

/** Estimated life this used, or more: "replacement approaching" (an estimate, never a promise). */
export const LIFE_NOTICE = 0.9;

const odometer = (message: string) => optionalInt(0, ODOMETER_MAX_KM, message);
const pastDate = z.iso
  .date("Enter the date")
  .refine((date) => date <= latestAllowedDate(), "This date is in the future");

/** The part itself: what, where, when fitted, how long it should last, warranty. */
const partFields = {
  brand: optionalText(60),
  partNumber: optionalText(60),
  expectedLifeKm: optionalInt(100, 1_000_000, "Enter a lifespan in km, e.g. 40000"),
  expectedLifeMonths: optionalInt(1, 240, "Enter a lifespan in months, e.g. 48"),
  warrantyUntil: optionalDate({ pastOnly: false }),
  warrantyKm: odometer("Enter the warranty limit in km"),
};

export const componentFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same component. */
  id: z.uuid("Invalid id").optional(),
  kind: z.enum(COMPONENT_KIND_KEYS, { error: "Choose what it is" }),
  name: z.string().trim().min(1, "Enter a name").max(80, "Use 80 characters or fewer"),
  /** "Front left", "Rear pair". */
  position: optionalText(40),
  ...partFields,
  installedAt: optionalDate({ pastOnly: true }),
  installedKm: odometer("Enter the odometer reading when it was fitted"),
  /** Workshop by name (one of the user's, or a new one). */
  providerName: optionalText(120),
  condition: z.enum(ComponentCondition, { error: "Choose a condition" }).optional(),
  notes: optionalText(1000),
});

export const createComponentSchema = componentFieldsSchema;

/** PATCH: profile fields only (condition changes through inspections, state through actions). */
export const updateComponentSchema = componentFieldsSchema
  .omit({ id: true, condition: true })
  .partial();

/** "Record inspection": the user's own check, updating the part's condition. */
export const inspectComponentSchema = z.object({
  date: pastDate,
  odometerKm: odometer("Enter the odometer reading"),
  condition: z.enum(ComponentCondition, { error: "Choose a condition" }),
  notes: optionalText(500),
});

/** "Mark removed": taken off without a replacement. */
export const removeComponentSchema = z.object({
  date: pastDate,
  odometerKm: odometer("Enter the odometer reading"),
  failed: z.boolean().optional(),
  notes: optionalText(500),
});

/**
 * "Replace": the old part is kept as history; the new one is fitted, and the work is logged as a
 * "Component replacement" service record (its cost goes to Expenses, its schedules restart).
 */
export const replaceComponentSchema = z.object({
  /** Client-generated id of the new component: a retried save returns it. */
  id: z.uuid("Invalid id").optional(),
  date: pastDate,
  odometerKm: odometer("Enter the odometer reading"),
  ...partFields,
  providerName: optionalText(120),
  totalAmount: optionalDecimal(10, 2, "Enter what it cost, e.g. 5400"),
  paymentMethod: z
    .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
    .optional(),
  notes: optionalText(500),
});

export const componentListQuerySchema = paginationQuerySchema.extend({
  /** Fitted parts, or the ones replaced and removed. */
  state: z.enum(["installed", "history"]).default("installed"),
  search: z.string().trim().max(80).optional(),
});

export type CreateComponentValues = z.output<typeof createComponentSchema>;
export type UpdateComponentValues = z.output<typeof updateComponentSchema>;
export type InspectComponentValues = z.output<typeof inspectComponentSchema>;
export type RemoveComponentValues = z.output<typeof removeComponentSchema>;
export type ReplaceComponentValues = z.output<typeof replaceComponentSchema>;
export type ComponentListQuery = z.output<typeof componentListQuerySchema>;

// ---- responses

/** Estimated life from the lifespan the user set: per track, then the most used. */
export interface ComponentLife {
  /** km used / expected km (may pass 1: past the estimate). Null without a km lifespan. */
  kmUsed: number | null;
  kmRemaining: number | null;
  estimatedKm: number | null;
  monthsUsed: number | null;
  daysRemaining: number | null;
  estimatedDate: string | null;
  /** The larger of the two fractions used (0–1+). */
  fractionUsed: number;
  /** The track behind `fractionUsed` (the one nearer its end). */
  decidedBy: "DISTANCE" | "TIME";
}

export interface ComponentHistoryEntry {
  /** A lifecycle event, a service record that worked on the part, or a checklist item on it. */
  source: "EVENT" | "RECORD" | "INSPECTION";
  type: ComponentEventType | "SERVICED";
  date: string;
  odometerKm: number | null;
  condition: ComponentCondition | null;
  notes: string | null;
  /** The service record behind it (its title), when there is one. */
  recordId: string | null;
  recordTitle: string | null;
  /** A checklist inspection that looked at the part, and what it found. */
  inspectionId: string | null;
  inspectionTitle: string | null;
  checklistCondition: InspectionCondition | null;
}

export interface VehicleComponent {
  id: string;
  vehicleId: string;
  kind: ComponentKind;
  name: string;
  position: string | null;
  brand: string | null;
  partNumber: string | null;
  installedAt: string | null;
  installedKm: number | null;
  provider: MaintenanceProvider | null;
  expectedLifeKm: number | null;
  expectedLifeMonths: number | null;
  warrantyUntil: string | null;
  warrantyKm: number | null;
  /** Null without a warranty; computed against today and the current odometer. */
  warrantyActive: boolean | null;
  condition: ComponentCondition;
  state: ComponentState;
  status: ComponentStatus;
  removedAt: string | null;
  removedKm: number | null;
  /** The service record that fitted it (a replacement). */
  installRecordId: string | null;
  replacedBy: { id: string; name: string } | null;
  replaces: { id: string; name: string } | null;
  life: ComponentLife | null;
  /** Schedules watching this part (e.g. "Battery inspection"). */
  schedules: { id: string; name: string; status: ScheduleStatus }[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleComponentDetail extends VehicleComponent {
  /** Oldest first. */
  history: ComponentHistoryEntry[];
}
