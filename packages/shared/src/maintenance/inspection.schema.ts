import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  blankToNull,
  latestAllowedDate,
  optionalDate,
  optionalInt,
  optionalText,
} from "../common/fields.js";
import { ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";
import type { MaintenanceCategoryKey } from "./maintenance-categories.js";
import type { MaintenanceProvider, ScheduleStatus } from "./maintenance.schema.js";

/** Inspections contract (module 5, condition monitoring). Rules: docs/architecture/maintenance.md. */

/** The user's own check, or a workshop's inspection (kept clearly apart). */
export const InspectionKind = { SELF_CHECK: "SELF_CHECK", PROFESSIONAL: "PROFESSIONAL" } as const;
export type InspectionKind = (typeof InspectionKind)[keyof typeof InspectionKind];

export const InspectionCondition = {
  GOOD: "GOOD",
  NORMAL: "NORMAL",
  MONITOR: "MONITOR",
  ATTENTION: "ATTENTION",
  REPLACE_SOON: "REPLACE_SOON",
  REPLACED: "REPLACED",
  NOT_INSPECTED: "NOT_INSPECTED",
} as const;
export type InspectionCondition = (typeof InspectionCondition)[keyof typeof InspectionCondition];

/** Findings worth acting on ("issues") and watching ("to monitor"). */
export const ISSUE_CONDITIONS: readonly InspectionCondition[] = ["ATTENTION", "REPLACE_SOON"];
export const FLAGGED_CONDITIONS: readonly InspectionCondition[] = [
  "MONITOR",
  "ATTENTION",
  "REPLACE_SOON",
];

/** A checklist's issues, items to monitor, fine items and unchecked items. */
export function inspectionCounts(conditions: readonly InspectionCondition[]) {
  const count = (match: (condition: InspectionCondition) => boolean) =>
    conditions.filter(match).length;
  return {
    issues: count((condition) => ISSUE_CONDITIONS.includes(condition)),
    monitor: count((condition) => condition === "MONITOR"),
    ok: count(
      (condition) => !FLAGGED_CONDITIONS.includes(condition) && condition !== "NOT_INSPECTED",
    ),
    notInspected: count((condition) => condition === "NOT_INSPECTED"),
  };
}

/** Checklist areas, with the maintenance work a follow-up on them is scheduled as. */
export const INSPECTION_AREAS = [
  ["TYRES", "Tyres", "TYRES.PRESSURE"],
  ["BRAKES", "Brakes", "BRAKES.INSPECTION"],
  ["FLUIDS", "Fluids", "GENERAL.INSPECTION"],
  ["LIGHTS", "Lights", "ELECTRICAL.WIRING"],
  ["BATTERY", "Battery", "ELECTRICAL.BATTERY_INSPECTION"],
  ["ENGINE", "Engine", "ENGINE.DIAGNOSTICS"],
  ["SUSPENSION", "Suspension", "SUSPENSION.INSPECTION"],
  ["AC", "AC", "AC.SERVICE"],
  ["EXTERIOR", "Exterior", "OTHER.OTHER"],
  ["INTERIOR", "Interior", "OTHER.OTHER"],
  ["SAFETY", "Safety equipment", "OTHER.OTHER"],
] as const satisfies readonly (readonly [string, string, MaintenanceCategoryKey])[];

export type InspectionArea = (typeof INSPECTION_AREAS)[number][0];
export const INSPECTION_AREA_KEYS = INSPECTION_AREAS.map(([key]) => key) as [
  InspectionArea,
  ...InspectionArea[],
];
export const inspectionAreaName = (area: string) =>
  INSPECTION_AREAS.find(([key]) => key === area)?.[1] ?? "Other";
/** The maintenance category a follow-up schedule on this area gets. */
export const inspectionAreaCategory = (area: string): MaintenanceCategoryKey =>
  INSPECTION_AREAS.find(([key]) => key === area)?.[2] ?? "OTHER.OTHER";

/**
 * Starting checklists (the user can add and remove items). Plain checks anyone can do; no
 * intervals or pass/fail thresholds are implied.
 */
export const INSPECTION_TEMPLATES = [
  {
    key: "QUICK",
    name: "Quick walk-around",
    items: [
      ["TYRES", "Tyre pressure"],
      ["TYRES", "Tyre tread and sidewalls"],
      ["LIGHTS", "Headlights, indicators and brake lights"],
      ["EXTERIOR", "Wipers and washer spray"],
      ["FLUIDS", "Engine oil level"],
      ["FLUIDS", "Coolant level"],
      ["FLUIDS", "Washer fluid level"],
      ["BATTERY", "Battery terminals"],
    ],
  },
  {
    key: "MONTHLY",
    name: "Monthly check",
    items: [
      ["TYRES", "Tyre pressure"],
      ["TYRES", "Tyre tread and sidewalls"],
      ["TYRES", "Spare tyre"],
      ["BRAKES", "Brake feel and noise"],
      ["FLUIDS", "Engine oil level"],
      ["FLUIDS", "Coolant level"],
      ["FLUIDS", "Brake fluid level"],
      ["FLUIDS", "Washer fluid level"],
      ["LIGHTS", "Headlights, indicators and brake lights"],
      ["BATTERY", "Battery terminals and start"],
      ["AC", "AC cooling"],
      ["EXTERIOR", "Wipers"],
      ["INTERIOR", "Horn and dashboard warning lights"],
      ["SAFETY", "Seat belts"],
    ],
  },
  {
    key: "PRE_TRIP",
    name: "Before a long trip",
    items: [
      ["TYRES", "Tyre pressure (including spare)"],
      ["TYRES", "Tyre tread and sidewalls"],
      ["BRAKES", "Brake feel and noise"],
      ["FLUIDS", "Engine oil level"],
      ["FLUIDS", "Coolant level"],
      ["LIGHTS", "All lights"],
      ["BATTERY", "Battery start"],
      ["EXTERIOR", "Wipers and washer spray"],
      ["AC", "AC cooling"],
      ["SAFETY", "First-aid kit, jack and warning triangle"],
    ],
  },
  {
    key: "WORKSHOP",
    name: "Workshop inspection",
    items: [
      ["ENGINE", "Engine and belts"],
      ["BRAKES", "Brake pads and discs"],
      ["TYRES", "Tyres and alignment"],
      ["BATTERY", "Battery health"],
      ["FLUIDS", "Fluids and leaks"],
      ["LIGHTS", "Lights and electrics"],
      ["SUSPENSION", "Suspension and steering"],
      ["AC", "AC performance"],
      ["EXTERIOR", "Body and underbody"],
      ["INTERIOR", "Interior and controls"],
      ["SAFETY", "Safety equipment"],
    ],
  },
  { key: "BLANK", name: "Blank", items: [] },
] as const satisfies readonly {
  key: string;
  name: string;
  items: readonly (readonly [InspectionArea, string])[];
}[];

export type InspectionTemplateKey = (typeof INSPECTION_TEMPLATES)[number]["key"];
export const INSPECTION_TEMPLATE_KEYS = INSPECTION_TEMPLATES.map((template) => template.key) as [
  InspectionTemplateKey,
  ...InspectionTemplateKey[],
];

const odometer = (message: string) => optionalInt(0, ODOMETER_MAX_KM, message);
export const INSPECTION_ITEMS_MAX = 60;

export const inspectionItemSchema = z.object({
  /** Kept on edit, so a follow-up schedule stays linked to its finding. */
  id: z.uuid().optional(),
  area: z.enum(INSPECTION_AREA_KEYS, { error: "Choose an area" }),
  label: z.string().trim().min(1, "Enter what was checked").max(80, "Use 80 characters or fewer"),
  condition: z.enum(InspectionCondition, { error: "Choose a condition" }),
  notes: optionalText(300),
  recommendedAction: optionalText(200),
  /** The tracked part this check was on (shows in its lifecycle). */
  componentId: z.preprocess(blankToNull, z.uuid("Choose a component").nullable()).optional(),
});

export const inspectionFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same inspection. */
  id: z.uuid("Invalid id").optional(),
  kind: z.enum(InspectionKind, { error: "Choose who inspected" }),
  templateKey: z.enum(INSPECTION_TEMPLATE_KEYS, { error: "Choose a checklist" }),
  title: z.string().trim().min(1, "Enter a title").max(80, "Use 80 characters or fewer"),
  date: z.iso
    .date("Enter the date")
    .refine((date) => date <= latestAllowedDate(), "This date is in the future"),
  odometerKm: odometer("Enter the odometer reading"),
  inspector: optionalText(80),
  /** A professional inspection's workshop, by name. */
  providerName: optionalText(120),
  followUpDate: optionalDate({ pastOnly: false }),
  notes: optionalText(1000),
  items: z
    .array(inspectionItemSchema)
    .min(1, "Add at least one item to the checklist")
    .max(INSPECTION_ITEMS_MAX, `Up to ${INSPECTION_ITEMS_MAX} items`),
});

/** A follow-up can't come before the inspection. Run on whole inspections only. */
export function checkInspection(
  values: { date?: string; followUpDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (values.date && values.followUpDate && values.followUpDate < values.date) {
    ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Before the inspection" });
  }
}

export const createInspectionSchema = inspectionFieldsSchema.superRefine(checkInspection);

/** PATCH: `items` replaces the checklist (items keep their ids). The API re-checks it whole. */
export const updateInspectionSchema = inspectionFieldsSchema.omit({ id: true }).partial();

export const inspectionListQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(InspectionKind).optional(),
});

export type CreateInspectionValues = z.output<typeof createInspectionSchema>;
export type UpdateInspectionValues = z.output<typeof updateInspectionSchema>;
export type InspectionListQuery = z.output<typeof inspectionListQuerySchema>;

// ---- responses

export interface InspectionItem {
  id: string;
  area: InspectionArea;
  label: string;
  condition: InspectionCondition;
  notes: string | null;
  recommendedAction: string | null;
  componentId: string | null;
  componentName: string | null;
  /** The schedule created from this finding (its status computed now). */
  followUpSchedule: { id: string; name: string; status: ScheduleStatus } | null;
}

export interface Inspection {
  id: string;
  vehicleId: string;
  kind: InspectionKind;
  templateKey: InspectionTemplateKey;
  title: string;
  date: string;
  odometerKm: number | null;
  inspector: string | null;
  provider: MaintenanceProvider | null;
  followUpDate: string | null;
  notes: string | null;
  items: InspectionItem[];
  counts: ReturnType<typeof inspectionCounts>;
  createdAt: string;
  updatedAt: string;
}
