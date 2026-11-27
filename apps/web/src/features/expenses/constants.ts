import {
  CostClass,
  type ExpenseCategoryRef,
  type ExpenseIcon,
  ExpenseSource,
  LoanMethod,
  PaymentState,
  RECURRENCE_PRESETS,
  RecurrenceUnit,
  RecurringStatus,
  RefundReason,
  SpendGroup,
  spendGroupOf,
} from "@automate/shared";
import {
  Armchair,
  BadgeIndianRupee,
  Ban,
  Battery,
  CalendarClock,
  Camera,
  Car,
  CarFront,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CirclePause,
  Clock,
  CreditCard,
  Droplets,
  FileText,
  Fuel,
  Hammer,
  Landmark,
  LifeBuoy,
  Lightbulb,
  type LucideIcon,
  Music,
  Package,
  PaintRoller,
  ParkingMeter,
  Receipt,
  Route,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Wrench,
} from "lucide-react";

import type { StatusTone } from "@/components/common/status-badge";

/** EXPENSE_ICONS (shared) → components. */
export const EXPENSE_ICON_COMPONENTS: Record<ExpenseIcon, LucideIcon> = {
  fuel: Fuel,
  wrench: Wrench,
  hammer: Hammer,
  "shield-check": ShieldCheck,
  landmark: Landmark,
  route: Route,
  sparkles: Sparkles,
  package: Package,
  "circle-dot": CircleDot,
  battery: Battery,
  car: Car,
  "car-front": CarFront,
  "parking-meter": ParkingMeter,
  droplets: Droplets,
  receipt: Receipt,
  "credit-card": CreditCard,
  "file-text": FileText,
  "life-buoy": LifeBuoy,
  lightbulb: Lightbulb,
  music: Music,
  camera: Camera,
  armchair: Armchair,
  "paint-roller": PaintRoller,
  "badge-indian-rupee": BadgeIndianRupee,
};

/**
 * One colour per category everywhere (design skill: color-system.md "Fixed category mapping"):
 * five chart colours, one per shared `SpendGroup`; everything else shares grey. The dashboard's
 * spending chart uses the same groups and colours.
 */
export const SPEND_GROUP_TONE: Record<SpendGroup, string> = {
  [SpendGroup.FUEL]: "text-chart-1",
  [SpendGroup.MAINTENANCE]: "text-chart-2",
  [SpendGroup.INSURANCE]: "text-chart-3",
  [SpendGroup.LOAN]: "text-chart-4",
  [SpendGroup.OTHER]: "text-chart-5",
};

/** The colour class for a category (by its top-level key; subcategory keys share their group's). */
export function categoryTone(category: Pick<ExpenseCategoryRef, "key">): string {
  return SPEND_GROUP_TONE[spendGroupOf(category.key)];
}

export const COST_CLASS_TEXT: Record<CostClass, { label: string; hint: string }> = {
  [CostClass.OPERATING]: {
    label: "Running cost",
    hint: "Using the vehicle: fuel, servicing, repairs, tolls, parking. Counts in cost per km.",
  },
  [CostClass.OWNERSHIP]: {
    label: "Ownership cost",
    hint: "Owning it whether or not it moves: insurance, taxes, registration, fines.",
  },
  [CostClass.FINANCING]: {
    label: "Loan",
    hint: "Loan payments: interest and charges are costs; principal only pays the loan down.",
  },
  [CostClass.CAPITAL]: {
    label: "Upgrade",
    hint: "Things added to the vehicle. Paid and part of owning it, but not running cost.",
  },
};

export const SOURCE_LABELS: Record<ExpenseSource, string> = {
  [ExpenseSource.MANUAL]: "Manual",
  [ExpenseSource.FUEL]: "Fuel entry",
  [ExpenseSource.MAINTENANCE]: "Service record",
  [ExpenseSource.TRIP]: "Trip",
  [ExpenseSource.RECURRING]: "Recurring",
  [ExpenseSource.IMPORT]: "Imported",
};

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  [RefundReason.REFUND]: "Refund",
  [RefundReason.REIMBURSEMENT]: "Reimbursement",
  [RefundReason.ADJUSTMENT]: "Adjustment",
};

// ---- recurring payments and loans (phase 4)

/** How a due date stands, as a badge (colour plus words, never colour alone). */
export const PAYMENT_STATE: Record<
  PaymentState,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  [PaymentState.OVERDUE]: { label: "Overdue", tone: "destructive", icon: CircleAlert },
  [PaymentState.DUE]: { label: "Due", tone: "warning", icon: Clock },
  [PaymentState.SCHEDULED]: { label: "Scheduled", tone: "neutral", icon: CalendarClock },
  [PaymentState.PAID]: { label: "Paid", tone: "success", icon: CircleCheck },
  [PaymentState.SKIPPED]: { label: "Skipped", tone: "neutral", icon: SkipForward },
};

export const RECURRING_STATUS: Record<
  RecurringStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  [RecurringStatus.ACTIVE]: { label: "Active", tone: "success", icon: CircleCheck },
  [RecurringStatus.PAUSED]: { label: "Paused", tone: "warning", icon: CirclePause },
  [RecurringStatus.CANCELLED]: { label: "Cancelled", tone: "neutral", icon: Ban },
};

const UNIT_NAMES: Record<RecurrenceUnit, [string, string]> = {
  [RecurrenceUnit.DAY]: ["day", "days"],
  [RecurrenceUnit.WEEK]: ["week", "weeks"],
  [RecurrenceUnit.MONTH]: ["month", "months"],
  [RecurrenceUnit.YEAR]: ["year", "years"],
};

/** "Monthly", "Quarterly"… or "Every 2 weeks". */
export function frequencyLabel(every: number, unit: RecurrenceUnit): string {
  const preset = Object.values(RECURRENCE_PRESETS).find(
    (item) => item.every === every && item.unit === unit,
  );
  if (preset) return preset.label;
  const [one, many] = UNIT_NAMES[unit];
  return every === 1 ? `Every ${one}` : `Every ${every} ${many}`;
}

export const LOAN_METHOD_LABELS: Record<LoanMethod, string> = {
  [LoanMethod.REDUCING]: "Reducing balance",
  [LoanMethod.FLAT]: "Flat rate",
};

/** The five chart series (shared `SpendGroup`) in the expense colours: Overview and dashboard. */
export const SPEND_GROUP_SERIES = {
  [SpendGroup.FUEL]: { label: "Fuel", color: "var(--chart-1)" },
  [SpendGroup.MAINTENANCE]: { label: "Maintenance & repairs", color: "var(--chart-2)" },
  [SpendGroup.INSURANCE]: { label: "Insurance & legal", color: "var(--chart-3)" },
  [SpendGroup.LOAN]: { label: "Loan interest & charges", color: "var(--chart-4)" },
  [SpendGroup.OTHER]: { label: "Everything else", color: "var(--chart-5)" },
} as const;
