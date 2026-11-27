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
import {
  checkPeriodQuery,
  periodQueryFields,
  type PeriodWindow,
  ReportingPeriod,
} from "../common/periods.js";
import { fromPaise, toPaise } from "../expenses/expense.schema.js";
import { ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";
import {
  MAINTENANCE_CATEGORY_KEYS,
  MAINTENANCE_GROUP_KEYS,
  type MaintenanceCategoryKey,
} from "./maintenance-categories.js";

/** Maintenance contract (module 5). Rules: docs/architecture/maintenance.md. */

export const SchedulePriority = { LOW: "LOW", NORMAL: "NORMAL", HIGH: "HIGH" } as const;
export type SchedulePriority = (typeof SchedulePriority)[keyof typeof SchedulePriority];

/** Computed on every read, never stored. Most urgent first. */
export const ScheduleStatus = {
  OVERDUE: "OVERDUE",
  DUE: "DUE",
  DUE_SOON: "DUE_SOON",
  UPCOMING: "UPCOMING",
  UP_TO_DATE: "UP_TO_DATE",
  PAUSED: "PAUSED",
  /** A one-time schedule that has been done. */
  COMPLETED: "COMPLETED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
} as const;
export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];

/** What a track counts from: a logged service, the user's "last done", the day it was added, or a fixed due. */
export const ScheduleBasis = {
  COMPLETION: "COMPLETION",
  LAST_DONE: "LAST_DONE",
  ADDED: "ADDED",
  FIXED: "FIXED",
} as const;
export type ScheduleBasis = (typeof ScheduleBasis)[keyof typeof ScheduleBasis];

/** The overview's one-line state. Never a health claim. */
export const MaintenanceState = {
  OVERDUE: "OVERDUE",
  ATTENTION: "ATTENTION",
  UPCOMING: "UPCOMING",
  ALL_CAUGHT_UP: "ALL_CAUGHT_UP",
  INCOMPLETE: "INCOMPLETE",
} as const;
export type MaintenanceState = (typeof MaintenanceState)[keyof typeof MaintenanceState];

/** Status windows: left until due, per track. The lead is the schedule's own (reminders). */
export const DUE_WINDOW = { days: 7, km: 500 } as const;
export const DEFAULT_REMINDER_LEAD = { days: 30, km: 1000 } as const;
export const UPCOMING_WINDOW = { days: 90, km: 3000 } as const;

const odometer = (message: string) => optionalInt(0, ODOMETER_MAX_KM, message);

export const scheduleFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same schedule. */
  id: z.uuid("Invalid id").optional(),
  name: z.string().trim().min(1, "Enter a name").max(80, "Use 80 characters or fewer"),
  categoryKey: z.enum(MAINTENANCE_CATEGORY_KEYS, { error: "Choose what it's for" }),
  // Repeats: every intervalKm and/or intervalMonths, whichever comes first.
  intervalKm: optionalInt(100, 500_000, "Enter the interval in km, e.g. 10000"),
  intervalMonths: optionalInt(1, 240, "Enter the interval in months, e.g. 12"),
  // Or happens once: at dueDate and/or dueKm, whichever comes first.
  dueDate: optionalDate({ pastOnly: false }),
  dueKm: odometer("Enter the odometer reading it's due at"),
  // Repeating only: when it was last done, if known.
  lastDoneDate: optionalDate({ pastOnly: true }),
  lastDoneKm: odometer("Enter the odometer reading when it was last done"),
  remindersEnabled: z.boolean().optional(),
  leadDays: optionalInt(0, 365, "Enter 0 to 365 days"),
  leadKm: optionalInt(0, 50_000, "Enter 0 to 50,000 km"),
  priority: z.enum(SchedulePriority, { error: "Choose a priority" }).optional(),
  /** The tracked part it watches (e.g. "Battery inspection" → the battery). */
  componentId: z.preprocess(blankToNull, z.uuid("Choose a component").nullable()).optional(),
  /** Create only: the inspection finding this schedule follows up (linked both ways). */
  inspectionItemId: z.uuid().optional(),
  notes: optionalText(1000),
});

type ScheduleRuleInput = Partial<
  Pick<
    z.output<typeof scheduleFieldsSchema>,
    "intervalKm" | "intervalMonths" | "dueDate" | "dueKm" | "lastDoneDate" | "lastDoneKm"
  >
>;

/** A schedule repeats or happens once, never both or neither. Run on whole records only. */
export function checkSchedule(values: ScheduleRuleInput, ctx: z.RefinementCtx) {
  const repeats = values.intervalKm != null || values.intervalMonths != null;
  const once = values.dueDate != null || values.dueKm != null;
  if (!repeats && !once) {
    ctx.addIssue({
      code: "custom",
      path: ["intervalKm"],
      message: "Set an interval in km or months, or a one-time due date or reading",
    });
  }
  if (repeats && once) {
    ctx.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: "A schedule either repeats or happens once. Clear the interval or the due",
    });
  }
  if (!repeats && (values.lastDoneDate != null || values.lastDoneKm != null)) {
    ctx.addIssue({
      code: "custom",
      path: ["lastDoneDate"],
      message: "Only a repeating schedule has a last done",
    });
  }
}

export const createScheduleSchema = scheduleFieldsSchema.superRefine(checkSchedule);

/** PATCH: null clears a field. The API merges onto the stored schedule and re-checks it whole. */
export const updateScheduleSchema = scheduleFieldsSchema
  .omit({ id: true, inspectionItemId: true })
  .partial();

export const scheduleListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ScheduleStatus).optional(),
  search: z.string().trim().max(80).optional(),
});

/** `GET /vehicles/:vehicleId/maintenance-overview`: the period of the spending section. */
export const maintenanceOverviewQuerySchema = z
  .object({
    ...periodQueryFields,
    period: z.enum(ReportingPeriod).default(ReportingPeriod.LAST_12_MONTHS),
  })
  .superRefine(checkPeriodQuery);

export type CreateScheduleInput = z.input<typeof createScheduleSchema>;
export type CreateScheduleValues = z.output<typeof createScheduleSchema>;
export type UpdateScheduleValues = z.output<typeof updateScheduleSchema>;
export type ScheduleListQuery = z.output<typeof scheduleListQuerySchema>;
export type MaintenanceOverviewQuery = z.output<typeof maintenanceOverviewQuerySchema>;

// ---- service and repair records

export const ServiceRecordType = {
  ROUTINE_SERVICE: "ROUTINE_SERVICE",
  PREVENTIVE: "PREVENTIVE",
  INSPECTION: "INSPECTION",
  REPAIR: "REPAIR",
  COMPONENT_REPLACEMENT: "COMPONENT_REPLACEMENT",
  EMERGENCY_REPAIR: "EMERGENCY_REPAIR",
  WARRANTY_REPAIR: "WARRANTY_REPAIR",
  MODIFICATION: "MODIFICATION",
  OTHER: "OTHER",
} as const;
export type ServiceRecordType = (typeof ServiceRecordType)[keyof typeof ServiceRecordType];

/** Their money goes to the Repairs expense category; the rest to Maintenance & servicing. */
export const REPAIR_RECORD_TYPES: readonly ServiceRecordType[] = [
  ServiceRecordType.REPAIR,
  ServiceRecordType.EMERGENCY_REPAIR,
  ServiceRecordType.WARRANTY_REPAIR,
];

export const SERVICE_RECORD_ITEMS_MAX = 30;

const money = (message: string) => optionalDecimal(10, 2, message);

export const serviceRecordItemSchema = z.object({
  name: z.string().trim().min(1, "Enter what was done").max(120, "Use 120 characters or fewer"),
  partNumber: optionalText(60),
  /** This item completes that schedule (restarts its countdown from this record). */
  scheduleId: z.preprocess(blankToNull, z.uuid("Choose a schedule").nullable()).optional(),
  /** The tracked part this work was on (shows in its lifecycle). */
  componentId: z.preprocess(blankToNull, z.uuid("Choose a component").nullable()).optional(),
});

export const serviceRecordFieldsSchema = z.object({
  /** Optional client-generated id: a retried save returns the same record. */
  id: z.uuid("Invalid id").optional(),
  type: z.enum(ServiceRecordType, { error: "Choose a record type" }),
  title: z.string().trim().min(1, "Enter a title").max(120, "Use 120 characters or fewer"),
  categoryKey: z.enum(MAINTENANCE_CATEGORY_KEYS, { error: "Choose what it's for" }),
  // Historical records are welcome: any past date, never a future one.
  serviceDate: z.iso
    .date("Enter the service date")
    .refine((date) => date <= latestAllowedDate(), "This date is in the future"),
  odometerKm: odometer("Enter the odometer reading in km"),
  /** A workshop by name: an existing one of the user's, or a new one saved to their workshops. */
  providerName: optionalText(120),
  technician: optionalText(80),
  description: optionalText(500),
  labourAmount: money("Enter the labour cost, e.g. 1200"),
  partsAmount: money("Enter the parts cost, e.g. 4800"),
  otherAmount: money("Enter other charges, e.g. 250"),
  taxAmount: money("Enter the tax, e.g. 1170"),
  discountAmount: money("Enter the discount, e.g. 500"),
  /** Needed only without a breakdown; with one, it must match (the API stores the computed total). */
  totalAmount: money("Enter the total paid, e.g. 6850"),
  paymentMethod: z
    .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
    .optional(),
  warrantyUntil: optionalDate({ pastOnly: false }),
  warrantyNotes: optionalText(300),
  notes: optionalText(1000),
  items: z
    .array(serviceRecordItemSchema)
    .max(SERVICE_RECORD_ITEMS_MAX, `Up to ${SERVICE_RECORD_ITEMS_MAX} items`)
    .optional(),
});

type CostInput = {
  labourAmount?: string | null;
  partsAmount?: string | null;
  otherAmount?: string | null;
  taxAmount?: string | null;
  discountAmount?: string | null;
  totalAmount?: string | null;
};

const BREAKDOWN = ["labourAmount", "partsAmount", "otherAmount", "taxAmount"] as const;

/** Labour + parts + other + tax − discount, in exact paise; null when no breakdown was entered. */
export function breakdownTotal(values: CostInput): number | null {
  const parts = [...BREAKDOWN, "discountAmount"] as const;
  if (parts.every((key) => !values[key])) return null;
  const sum = BREAKDOWN.reduce((total, key) => total + toPaise(values[key] ?? "0"), 0);
  return sum - toPaise(values.discountAmount ?? "0");
}

/** What the record cost: the breakdown's total, else the total entered, else nothing ("0.00"). */
export function serviceRecordTotal(values: CostInput): string {
  const computed = breakdownTotal(values);
  return fromPaise(computed ?? (values.totalAmount ? toPaise(values.totalAmount) : 0));
}

type RecordRuleInput = CostInput & {
  serviceDate?: string;
  warrantyUntil?: string | null;
  items?: { scheduleId?: string | null }[];
};

/** Cross-field rules every client and the API share. Run on whole records only. */
export function checkServiceRecord(values: RecordRuleInput, ctx: z.RefinementCtx) {
  const computed = breakdownTotal(values);
  if (computed !== null && computed < 0) {
    ctx.addIssue({ code: "custom", path: ["discountAmount"], message: "More than the charges" });
  } else if (computed !== null && values.totalAmount && toPaise(values.totalAmount) !== computed) {
    ctx.addIssue({
      code: "custom",
      path: ["totalAmount"],
      message: `Doesn't match the breakdown (₹${fromPaise(computed)})`,
    });
  }
  if (values.warrantyUntil && values.serviceDate && values.warrantyUntil < values.serviceDate) {
    ctx.addIssue({ code: "custom", path: ["warrantyUntil"], message: "Ends before the service" });
  }
  const seen = new Set<string>();
  values.items?.forEach((item, index) => {
    if (!item.scheduleId) return;
    if (seen.has(item.scheduleId)) {
      ctx.addIssue({
        code: "custom",
        path: ["items", index, "scheduleId"],
        message: "Another item already completes this schedule",
      });
    }
    seen.add(item.scheduleId);
  });
}

export const createServiceRecordSchema = serviceRecordFieldsSchema.superRefine(checkServiceRecord);

/** PATCH: null clears a field; `items` replaces the list. The API merges and re-checks it whole. */
export const updateServiceRecordSchema = serviceRecordFieldsSchema.omit({ id: true }).partial();

/** Service history filters (applied by the API before paging). */
const serviceRecordFilterFields = {
  /** The records that completed this schedule (its history). */
  scheduleId: z.uuid().optional(),
  /** Title, workshop, items and part numbers, description, notes, category name. */
  search: z.string().trim().max(80).optional(),
  from: z.iso.date("Enter a valid date").optional(),
  to: z.iso.date("Enter a valid date").optional(),
  group: z.enum(MAINTENANCE_GROUP_KEYS).optional(),
  type: z.enum(ServiceRecordType).optional(),
  providerId: z.uuid().optional(),
  minAmount: money("Enter an amount, e.g. 1000"),
  maxAmount: money("Enter an amount, e.g. 10000"),
  minKm: odometer("Enter a reading in km"),
  maxKm: odometer("Enter a reading in km"),
};

type FilterRange = Partial<Record<"from" | "to" | "minAmount" | "maxAmount", string | null>> &
  Partial<Record<"minKm" | "maxKm", number | null>>;

function checkFilterRanges(value: FilterRange, ctx: z.RefinementCtx) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });
  if (value.from && value.to && value.from > value.to) issue("to", "Ends before it starts");
  if (value.minAmount && value.maxAmount && toPaise(value.minAmount) > toPaise(value.maxAmount)) {
    issue("maxAmount", "Less than the minimum");
  }
  if (value.minKm != null && value.maxKm != null && value.minKm > value.maxKm) {
    issue("maxKm", "Less than the minimum");
  }
}

export const serviceRecordFiltersSchema = z
  .object(serviceRecordFilterFields)
  .superRefine(checkFilterRanges);

export const serviceRecordListQuerySchema = paginationQuerySchema
  .extend(serviceRecordFilterFields)
  .superRefine(checkFilterRanges);

export type CreateServiceRecordInput = z.input<typeof createServiceRecordSchema>;
export type CreateServiceRecordValues = z.output<typeof createServiceRecordSchema>;
export type UpdateServiceRecordValues = z.output<typeof updateServiceRecordSchema>;
export type ServiceRecordListQuery = z.output<typeof serviceRecordListQuerySchema>;
export type ServiceRecordFilters = z.output<typeof serviceRecordFiltersSchema>;

// ---- responses

/** The date track: counted from `from`, due on `nextDue`. Negative days = overdue by that many. */
export interface ScheduleDateTrack {
  from: string | null;
  basis: ScheduleBasis;
  nextDue: string;
  daysRemaining: number;
  status: ScheduleStatus;
}

/** The distance track, against the vehicle's current odometer. Negative km = overdue by that many. */
export interface ScheduleDistanceTrack {
  fromKm: number | null;
  basis: ScheduleBasis;
  nextDueKm: number;
  kmRemaining: number;
  status: ScheduleStatus;
}

export interface ScheduleDue {
  status: ScheduleStatus;
  /** The more urgent track, which sets the status (whichever comes first). */
  decidedBy: "DATE" | "DISTANCE" | null;
  date: ScheduleDateTrack | null;
  distance: ScheduleDistanceTrack | null;
}

export interface MaintenanceSchedule {
  id: string;
  vehicleId: string;
  name: string;
  categoryKey: MaintenanceCategoryKey;
  intervalKm: number | null;
  intervalMonths: number | null;
  dueDate: string | null;
  dueKm: number | null;
  lastDoneDate: string | null;
  lastDoneKm: number | null;
  /** The vehicle's odometer when the schedule was added (the distance basis until it's done). */
  addedOdometerKm: number;
  remindersEnabled: boolean;
  /** Null: the default lead (DEFAULT_REMINDER_LEAD). */
  leadDays: number | null;
  leadKm: number | null;
  priority: SchedulePriority;
  component: { id: string; name: string } | null;
  notes: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  due: ScheduleDue;
}

export interface ServiceRecordItem {
  id: string;
  name: string;
  partNumber: string | null;
  scheduleId: string | null;
  /** The completed schedule's name (null once that schedule is deleted). */
  scheduleName: string | null;
  componentId: string | null;
  componentName: string | null;
}

/** A workshop or other service provider of the user's (profiles arrive with Workshops). */
export interface MaintenanceProvider {
  id: string;
  name: string;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  type: ServiceRecordType;
  title: string;
  categoryKey: MaintenanceCategoryKey;
  serviceDate: string;
  odometerKm: number | null;
  provider: MaintenanceProvider | null;
  technician: string | null;
  description: string | null;
  labourAmount: string | null;
  partsAmount: string | null;
  otherAmount: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  /** Computed by the API ("0.00" when nothing was paid). */
  totalAmount: string;
  paymentMethod: PaymentMethod | null;
  warrantyUntil: string | null;
  warrantyNotes: string | null;
  notes: string | null;
  items: ServiceRecordItem[];
  /** Its money in Expenses; null when it cost nothing. */
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The filtered history at a glance (all pages). */
export interface ServiceRecordSummary {
  count: number;
  totalAmount: string;
}

export interface MaintenanceSpendMonth {
  /** YYYY-MM (IST). */
  month: string;
  maintenance: string;
  repairs: string;
}

/** From Expenses: the Maintenance & servicing and Repairs categories, net of refunds. */
export interface MaintenanceSpend {
  total: string;
  maintenance: string;
  repairs: string;
  /** The same-length window before (PeriodWindow.previous). */
  previousTotal: string;
  months: MaintenanceSpendMonth[];
}

export interface MaintenanceOverview {
  odometerKm: number;
  period: PeriodWindow;
  state: MaintenanceState;
  counts: Record<ScheduleStatus, number>;
  /** Every overdue schedule, whatever the period. */
  overdue: MaintenanceSchedule[];
  /** The next schedules due (due, due soon, upcoming), most urgent first, at most 5. */
  upcoming: MaintenanceSchedule[];
  /** The most urgent active schedule that isn't overdue. */
  next: MaintenanceSchedule | null;
  /** Every service record of the vehicle (any date). */
  recordCount: number;
  /** The latest records by service date, at most 5; the first is the last service. */
  recent: ServiceRecord[];
  spend: MaintenanceSpend;
}
