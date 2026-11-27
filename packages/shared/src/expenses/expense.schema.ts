import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  blankToNull,
  latestAllowedDate,
  optionalDate,
  optionalDecimal,
  optionalInt,
  optionalText,
  positiveDecimal,
} from "../common/fields.js";
import { PaymentMethod } from "../common/payment-method.js";
import { ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";
import { CostClass, EXPENSE_ICONS, type ExpenseIcon } from "./expense-categories.js";

/** Expense contract (module 4) shared by apps/api (validation) and apps/web (forms). */

/** Where an expense comes from. Linked sources are owned by their module and read-only here. */
export const ExpenseSource = {
  MANUAL: "MANUAL",
  FUEL: "FUEL",
  MAINTENANCE: "MAINTENANCE",
  TRIP: "TRIP",
  RECURRING: "RECURRING",
  IMPORT: "IMPORT",
} as const;
export type ExpenseSource = (typeof ExpenseSource)[keyof typeof ExpenseSource];

/** Edited in their own module ("Edit in Fuel"), never here, so the two can't disagree. */
export const LINKED_EXPENSE_SOURCES: readonly ExpenseSource[] = [
  ExpenseSource.FUEL,
  ExpenseSource.MAINTENANCE,
  ExpenseSource.TRIP,
];

/** A refund reduces net spending and points at the expense it refunds; the original is kept. */
export const ExpenseKind = { EXPENSE: "EXPENSE", REFUND: "REFUND" } as const;
export type ExpenseKind = (typeof ExpenseKind)[keyof typeof ExpenseKind];

export const RefundReason = {
  REFUND: "REFUND",
  REIMBURSEMENT: "REIMBURSEMENT",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type RefundReason = (typeof RefundReason)[keyof typeof RefundReason];

export const MAX_SHARED_VEHICLES = 10;
export const BULK_MAX = 100;

// ---- money in exact integer paise (no float, no decimal library)

/** "1499.5" → 149950. Inputs are validated decimals with at most 2 places. */
export function toPaise(amount: string): number {
  const [whole = "0", fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

/** 149950 → "1499.50" */
export function fromPaise(paise: number): string {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/** Splits an amount into `parts` shares that add up exactly: the first shares take the spare paise. */
export function splitEqually(amount: string, parts: number): string[] {
  const total = toPaise(amount);
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  return Array.from({ length: parts }, (_, index) => fromPaise(base + (index < extra ? 1 : 0)));
}

// ---- schemas

const amount = (message: string) => positiveDecimal(10, 2, message);
const optionalAmount = (message: string) => optionalDecimal(10, 2, message);

/** A calendar date, not after today (a day of tolerance for the IST/UTC boundary). */
const expenseDate = z.iso
  .date("Enter a valid date")
  .refine((date) => date <= latestAllowedDate(), "This date is in the future");

/** One vehicle, or an explicitly shared expense split across several (never assumed). */
export const expenseAllocationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("single"), vehicleId: z.uuid("Choose a vehicle") }),
  z.object({
    mode: z.literal("shared"),
    split: z.enum(["equal", "custom"]),
    vehicles: z
      .array(
        z.object({
          vehicleId: z.uuid("Choose a vehicle"),
          /** Custom split only: this vehicle's share. */
          amount: optionalAmount("Enter this vehicle's share"),
        }),
      )
      .min(2, "Choose at least two vehicles to share it")
      .max(MAX_SHARED_VEHICLES, `Share across at most ${MAX_SHARED_VEHICLES} vehicles`),
  }),
]);
export type ExpenseAllocation = z.output<typeof expenseAllocationSchema>;

export const expenseFieldsSchema = z.object({
  /** Optional client-generated id (offline-ready; a retried save can't create a second row). */
  id: z.uuid("Invalid id").optional(),
  allocation: expenseAllocationSchema,
  categoryId: z.uuid("Choose a category"),
  subcategoryId: z.preprocess(blankToNull, z.uuid("Choose a subcategory").nullable()).optional(),
  title: z.string().trim().min(1, "Enter a title").max(120, "Use 120 characters or fewer"),
  /** The whole amount; a shared expense is split across its vehicles. */
  amount: amount("Enter the amount, e.g. 850"),
  date: expenseDate,
  paymentMethod: z
    .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
    .optional(),
  vendor: optionalText(120),
  odometerKm: optionalInt(0, ODOMETER_MAX_KM, "Enter the odometer reading in km"),
  description: optionalText(500),
  notes: optionalText(1000),
  // Finance: required for Finance categories, and they must add up to the amount.
  principalAmount: optionalAmount("Enter the principal, e.g. 10950"),
  interestAmount: optionalAmount("Enter the interest, e.g. 5734"),
  chargesAmount: optionalAmount("Enter the charges, e.g. 0"),
  loanReference: optionalText(60),
  loanOutstanding: optionalAmount("Enter the outstanding balance"),
  // Category details (maintenance, repairs, insurance); shown only where they apply.
  serviceType: optionalText(80),
  partsReplaced: optionalText(300),
  partsAmount: optionalAmount("Enter the parts cost"),
  labourAmount: optionalAmount("Enter the labour cost"),
  warrantyUntil: optionalDate({ pastOnly: false }),
  provider: optionalText(80),
  policyNumber: optionalText(60),
  policyStart: optionalDate({ pastOnly: false }),
  policyEnd: optionalDate({ pastOnly: false }),
});

type ExpenseRuleInput = {
  amount?: string;
  allocation?: ExpenseAllocation;
  principalAmount?: string | null;
  interestAmount?: string | null;
  chargesAmount?: string | null;
  partsAmount?: string | null;
  labourAmount?: string | null;
  policyStart?: string | null;
  policyEnd?: string | null;
};

const paise = (value: string | null | undefined) => (value ? toPaise(value) : 0);

/** Cross-field rules every client and the API share. */
export function checkExpense(values: ExpenseRuleInput, ctx: z.RefinementCtx) {
  const { amount: total, allocation } = values;
  if (allocation?.mode === "shared") {
    const ids = allocation.vehicles.map((item) => item.vehicleId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allocation", "vehicles"],
        message: "Each vehicle once",
      });
    }
    if (allocation.split === "custom" && total) {
      const shares = allocation.vehicles.map((item) => item.amount);
      if (shares.some((share) => !share)) {
        ctx.addIssue({
          code: "custom",
          path: ["allocation", "vehicles"],
          message: "Enter every vehicle's share",
        });
      } else if (shares.some((share) => paise(share) === 0)) {
        ctx.addIssue({
          code: "custom",
          path: ["allocation", "vehicles"],
          message: "Every share must be more than ₹0; leave out a vehicle that pays nothing",
        });
      } else if (shares.reduce((sum, share) => sum + paise(share), 0) !== toPaise(total)) {
        ctx.addIssue({
          code: "custom",
          path: ["allocation", "vehicles"],
          message: "The shares must add up to the amount",
        });
      }
    }
  }
  const components = [values.principalAmount, values.interestAmount, values.chargesAmount];
  if (total && components.some(Boolean)) {
    if (components.reduce((sum, part) => sum + paise(part), 0) !== toPaise(total)) {
      ctx.addIssue({
        code: "custom",
        path: ["principalAmount"],
        message: "Principal, interest and charges must add up to the amount",
      });
    }
  }
  if (total && paise(values.partsAmount) + paise(values.labourAmount) > toPaise(total)) {
    ctx.addIssue({
      code: "custom",
      path: ["labourAmount"],
      message: "Parts and labour can't be more than the amount",
    });
  }
  if (values.policyStart && values.policyEnd && values.policyEnd < values.policyStart) {
    ctx.addIssue({ code: "custom", path: ["policyEnd"], message: "Ends before it starts" });
  }
}

export const createExpenseSchema = expenseFieldsSchema.superRefine(checkExpense);

/**
 * PATCH. For a shared expense, `amount` is the whole amount and comes with its `allocation`
 * (the API re-splits the group). The API re-checks the merged record.
 */
export const updateExpenseSchema = expenseFieldsSchema
  .omit({ id: true })
  .partial()
  .superRefine(checkExpense);

export const createRefundSchema = z.object({
  amount: amount("Enter the refunded amount"),
  date: expenseDate,
  reason: z.enum(RefundReason, { error: "Choose why money came back" }),
  notes: optionalText(500),
});

const bulkIds = z
  .array(z.uuid())
  .min(1, "Choose at least one expense")
  .max(BULK_MAX, `At most ${BULK_MAX} at a time`);

export const bulkExpenseIdsSchema = z.object({ ids: bulkIds });
export const bulkRecategoriseSchema = z.object({
  ids: bulkIds,
  categoryId: z.uuid("Choose a category"),
  subcategoryId: z.uuid().nullable().optional(),
});

export const ExpenseSort = {
  DATE_DESC: "date_desc",
  DATE_ASC: "date_asc",
  AMOUNT_DESC: "amount_desc",
  AMOUNT_ASC: "amount_asc",
} as const;
export type ExpenseSort = (typeof ExpenseSort)[keyof typeof ExpenseSort];

const decimalQuery = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount");

/** `GET /expenses`: every filter is applied by the API, before paging. */
export const expenseListQuerySchema = paginationQuerySchema
  .extend({
    /** Omitted: every vehicle. */
    vehicleId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    /** A category or a subcategory. */
    categoryId: z.uuid().optional(),
    paymentMethod: z.enum(PaymentMethod).optional(),
    source: z.enum(ExpenseSource).optional(),
    kind: z.enum(ExpenseKind).optional(),
    minAmount: decimalQuery.optional(),
    maxAmount: decimalQuery.optional(),
    search: z.string().trim().max(80).optional(),
    sort: z.enum(ExpenseSort).default(ExpenseSort.DATE_DESC),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "The end date is before the start date",
  })
  .refine(
    (query) =>
      !query.minAmount || !query.maxAmount || toPaise(query.minAmount) <= toPaise(query.maxAmount),
    { path: ["maxAmount"], message: "The maximum is below the minimum" },
  );
export type ExpenseListQuery = z.output<typeof expenseListQuerySchema>;

// ---- categories

export const createExpenseCategorySchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer"),
    icon: z.enum(EXPENSE_ICONS, { error: "Choose an icon" }),
    /** Set: a subcategory of that category (it inherits the cost class). */
    parentId: z.uuid().optional(),
    /** Required for a top-level category: which money views it counts in. */
    costClass: z.enum(CostClass).optional(),
  })
  .refine((value) => value.parentId || value.costClass, {
    path: ["costClass"],
    message: "Choose what kind of cost this is",
  });

export const updateExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer").optional(),
  icon: z.enum(EXPENSE_ICONS).optional(),
  /** Disabled categories keep their history but can't be chosen for new expenses. */
  active: z.boolean().optional(),
});

export const expenseCategoryListQuerySchema = paginationQuerySchema.extend({
  includeInactive: z.stringbool().default(false),
});

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateExpenseValues = z.output<typeof createExpenseSchema>;
export type UpdateExpenseValues = z.output<typeof updateExpenseSchema>;
export type CreateRefundValues = z.output<typeof createRefundSchema>;
export type CreateExpenseCategoryValues = z.output<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryValues = z.output<typeof updateExpenseCategorySchema>;

// ---- responses

/** A category as an expense refers to it. A subcategory reports its parent's cost class. */
export interface ExpenseCategoryRef {
  id: string;
  /** System categories only (e.g. "DAILY_USAGE.TOLL"); null for custom ones. */
  key: string | null;
  name: string;
  icon: ExpenseIcon;
  costClass: CostClass;
}

export interface ExpenseCategory extends ExpenseCategoryRef {
  parentId: string | null;
  custom: boolean;
  active: boolean;
  /** Expenses filed under it (a top-level category counts its subcategories' too). */
  usage: number;
  subcategories: ExpenseCategory[];
}

/** An expense as the API returns it. Money is a decimal string; dates are YYYY-MM-DD. */
export interface Expense {
  id: string;
  vehicleId: string;
  kind: ExpenseKind;
  title: string;
  /** This row's amount; for a shared expense, this vehicle's share. */
  amount: string;
  date: string;
  category: ExpenseCategoryRef;
  subcategory: ExpenseCategoryRef | null;
  paymentMethod: PaymentMethod | null;
  vendor: string | null;
  odometerKm: number | null;
  description: string | null;
  notes: string | null;
  source: ExpenseSource;
  /** The record in the source module (e.g. the fuel entry's id). */
  sourceId: string | null;
  /** False for linked sources: edit them in their own module. */
  editable: boolean;
  /** Refunds: the expense they refund, and why. */
  refundOfId: string | null;
  refundReason: RefundReason | null;
  /** Expenses: how much of this row has been refunded so far. */
  refundedAmount: string;
  shared: { groupId: string; totalAmount: string; vehicleCount: number } | null;
  finance: {
    principal: string | null;
    interest: string | null;
    charges: string | null;
    loanReference: string | null;
    loanOutstanding: string | null;
  } | null;
  details: {
    serviceType: string | null;
    partsReplaced: string | null;
    partsAmount: string | null;
    labourAmount: string | null;
    warrantyUntil: string | null;
    provider: string | null;
    policyNumber: string | null;
    policyStart: string | null;
    policyEnd: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/** One expense with what surrounds it (the details panel). */
export interface ExpenseDetail extends Expense {
  refunds: Expense[];
  /** Shared expenses: every vehicle's share. */
  group: { expenseId: string; vehicleId: string; amount: string }[];
}

export interface BulkResult {
  /** Rows changed. */
  affected: number;
  /** Linked or otherwise locked rows left as they were. */
  skipped: number;
}

// ---- overview

/** `GET /expenses/summary`: one vehicle, or every vehicle when omitted. */
export const expenseSummaryQuerySchema = z.object({ vehicleId: z.uuid().optional() });
export type ExpenseSummaryQuery = z.output<typeof expenseSummaryQuerySchema>;

/**
 * The Overview tab's figures (Stitch "Expenses"), computed by the API for the current IST month
 * and year. Definitions: docs/architecture/expenses.md §1. Refunds are subtracted throughout.
 */
export interface ExpenseSummary {
  /** The month the figures are for, "2026-11" (IST). */
  month: string;
  operating: {
    thisMonth: string;
    lastMonth: string;
    /** Change vs last month, whole percent; null when last month had no operating cost. */
    changePercent: number | null;
    /** 1 January to today. */
    thisYear: string;
    /** Months this year from the first one with an operating cost, up to this one. */
    monthsCovered: number;
    /** thisYear ÷ monthsCovered; null before the first operating cost this year. */
    monthlyAverage: string | null;
  };
  /** Operating cost ÷ km driven this year, over vehicles with enough odometer readings. */
  costPerKm: string | null;
  /** Km driven this year behind `costPerKm`; null with too few readings. */
  distanceKm: number | null;
  /** Loan payments this month, whole EMIs (principal too): cash out, not running cost. */
  loanOutflowThisMonth: string;
  /** Everything paid this month, every kind of cost. */
  cashOutflowThisMonth: string;
  /** This month's operating cost by category, largest first. */
  categories: { category: ExpenseCategoryRef; amount: string; percent: number }[];
}
