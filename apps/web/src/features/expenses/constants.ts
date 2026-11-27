import {
  CostClass,
  type ExpenseCategoryRef,
  type ExpenseIcon,
  ExpenseSource,
  RefundReason,
} from "@automate/shared";
import {
  Armchair,
  BadgeIndianRupee,
  Battery,
  Camera,
  Car,
  CarFront,
  CircleDot,
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
  Sparkles,
  Wrench,
} from "lucide-react";

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
 * One colour per category everywhere (design skill: color-system.md "Fixed category mapping").
 * Five chart colours: the four biggest groups get their own, everything else shares grey.
 */
const CHART_TOKEN_BY_GROUP: Record<string, string> = {
  FUEL: "text-chart-1",
  MAINTENANCE: "text-chart-2",
  REPAIRS: "text-chart-2",
  INSURANCE_LEGAL: "text-chart-3",
  FINANCE: "text-chart-4",
};

/** The colour class for a category (by its top-level key; subcategory keys share their group's). */
export function categoryTone(category: Pick<ExpenseCategoryRef, "key">): string {
  const group = category.key?.split(".")[0];
  return (group && CHART_TOKEN_BY_GROUP[group]) ?? "text-chart-5";
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
