import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import {
  blankToNull,
  latestAllowedDate,
  optionalDecimal,
  optionalText,
  positiveDecimal,
  requiredInt,
} from "../common/fields.js";
import { PaymentMethod } from "../common/payment-method.js";
import type { ExpenseCategoryRef } from "./expense.schema.js";

/**
 * Recurring payments and vehicle loans (Expenses phase 4, docs/architecture/expenses.md §6). A
 * schedule is never a payment: a due date becomes an expense only when it's marked paid.
 */

export const RecurrenceUnit = { DAY: "DAY", WEEK: "WEEK", MONTH: "MONTH", YEAR: "YEAR" } as const;
export type RecurrenceUnit = (typeof RecurrenceUnit)[keyof typeof RecurrenceUnit];

export const RecurringStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
} as const;
export type RecurringStatus = (typeof RecurringStatus)[keyof typeof RecurringStatus];

/** The frequencies the form offers; anything else is a custom `every` × `unit`. */
export const RECURRENCE_PRESETS = {
  weekly: { every: 1, unit: RecurrenceUnit.WEEK, label: "Weekly" },
  monthly: { every: 1, unit: RecurrenceUnit.MONTH, label: "Monthly" },
  quarterly: { every: 3, unit: RecurrenceUnit.MONTH, label: "Quarterly" },
  half_yearly: { every: 6, unit: RecurrenceUnit.MONTH, label: "Half-yearly" },
  yearly: { every: 1, unit: RecurrenceUnit.YEAR, label: "Yearly" },
} as const;

/** How one due date stands. Scheduled, due and overdue are worked out from today's date. */
export const PaymentState = {
  SCHEDULED: "SCHEDULED",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  SKIPPED: "SKIPPED",
} as const;
export type PaymentState = (typeof PaymentState)[keyof typeof PaymentState];

export const LoanMethod = { REDUCING: "REDUCING", FLAT: "FLAT" } as const;
export type LoanMethod = (typeof LoanMethod)[keyof typeof LoanMethod];

const day = z.iso.date("Enter a valid date");
const optionalDay = z.preprocess(blankToNull, day.nullable()).optional();
const paidDay = day.refine((date) => date <= latestAllowedDate(), "This date is in the future");
const paymentMethod = z
  .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
  .optional();
/** % a year, up to two decimals (0 for an interest-free loan). */
const annualRate = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z
    .string("Enter the interest rate, e.g. 9.25")
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "Enter the interest rate, e.g. 9.25")
    .refine((value) => Number(value) <= 50, "Enter a rate of 50% or less"),
);
const reminderDays = z.coerce
  .number("Enter a number of days")
  .int("Enter whole days")
  .min(0, "Enter 0 or more days")
  .max(60, "Remind at most 60 days ahead")
  .default(3);

// ---- recurring schedules

export const recurringExpenseFieldsSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  title: z.string().trim().min(1, "Enter a title").max(120, "Use 120 characters or fewer"),
  amount: positiveDecimal(10, 2, "Enter the amount, e.g. 1500"),
  categoryId: z.uuid("Choose a category"),
  subcategoryId: z.preprocess(blankToNull, z.uuid("Choose a subcategory").nullable()).optional(),
  paymentMethod,
  vendor: optionalText(120),
  notes: optionalText(1000),
  every: requiredInt(1, 365, "Repeat every 1 to 365"),
  unit: z.enum(RecurrenceUnit, { error: "Choose how often" }),
  /** The first due date. */
  startDate: day,
  endDate: optionalDay,
  reminderDays,
});

const endsAfterStart = (value: { startDate?: string; endDate?: string | null }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;

export const createRecurringExpenseSchema = recurringExpenseFieldsSchema.refine(endsAfterStart, {
  path: ["endDate"],
  message: "Ends before it starts",
});
/** Merged onto the stored schedule and checked whole; the vehicle can't change. */
export const updateRecurringExpenseSchema = recurringExpenseFieldsSchema
  .omit({ vehicleId: true })
  .partial();

export const recurringListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle").optional(),
  status: z.enum(RecurringStatus).optional(),
});

/** Upcoming: overdue, due and scheduled in the next 90 days, soonest first. History: newest first. */
export const recurringPaymentsQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle").optional(),
  recurringId: z.uuid().optional(),
  view: z.enum(["upcoming", "history"]).default("upcoming"),
});

export const UPCOMING_DAYS = 90;

/** Marking a due date paid creates its expense, once. */
export const payRecurringSchema = z.object({
  date: paidDay,
  /** Not for a loan EMI, whose amount comes from its schedule. */
  amount: optionalDecimal(10, 2, "Enter the amount paid"),
  /** Loan EMI only: late fees or bounce charges paid with it (a cost, not principal). */
  chargesAmount: optionalDecimal(10, 2, "Enter the charges, e.g. 0"),
  paymentMethod,
  notes: optionalText(1000),
});

export const postponeRecurringSchema = z.object({ to: day });

export type CreateRecurringExpenseValues = z.output<typeof createRecurringExpenseSchema>;
export type CreateRecurringExpenseInput = z.input<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseValues = z.output<typeof updateRecurringExpenseSchema>;
export type RecurringListQuery = z.output<typeof recurringListQuerySchema>;
export type RecurringPaymentsQuery = z.output<typeof recurringPaymentsQuerySchema>;
export type PayRecurringValues = z.output<typeof payRecurringSchema>;
export type PostponeRecurringValues = z.output<typeof postponeRecurringSchema>;

/** One due date of a schedule. */
export interface RecurringPayment {
  recurringId: string;
  vehicleId: string;
  title: string;
  category: ExpenseCategoryRef;
  /** The scheduled date (the payment's identity). */
  dueDate: string;
  /** When it's now due: the postponed date, or the due date. */
  date: string;
  /** What's owed: the schedule's amount, or the loan's EMI for that month. */
  amount: string;
  state: PaymentState;
  postponed: boolean;
  /** The expense recorded when it was paid. */
  expenseId: string | null;
  /** A loan EMI: which one, and its split. */
  loan: { loanId: string; number: number; of: number; principal: string; interest: string } | null;
}

export interface RecurringExpense {
  id: string;
  vehicleId: string;
  title: string;
  amount: string;
  category: ExpenseCategoryRef;
  subcategory: ExpenseCategoryRef | null;
  paymentMethod: PaymentMethod | null;
  vendor: string | null;
  notes: string | null;
  every: number;
  unit: RecurrenceUnit;
  startDate: string;
  endDate: string | null;
  reminderDays: number;
  status: RecurringStatus;
  /** Set for a loan's EMI schedule: edit the loan, not the schedule. */
  loanId: string | null;
  /** The next unpaid due date (overdue first), if any. */
  next: RecurringPayment | null;
  /** Unpaid due dates that have passed. */
  overdue: number;
  createdAt: string;
  updatedAt: string;
}

// ---- vehicle loans

export const vehicleLoanFieldsSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  lender: z.string().trim().min(1, "Enter the lender").max(80, "Use 80 characters or fewer"),
  accountNumber: optionalText(40),
  principal: positiveDecimal(10, 2, "Enter the loan amount, e.g. 800000"),
  annualRate,
  tenureMonths: requiredInt(1, 120, "Enter the tenure in months, 1 to 120"),
  firstEmiDate: day,
  method: z.enum(LoanMethod).default(LoanMethod.REDUCING),
  processingFee: optionalDecimal(10, 2, "Enter the processing fee, e.g. 5000"),
  /** For the EMI schedule. */
  paymentMethod,
  reminderDays,
});

export const createVehicleLoanSchema = vehicleLoanFieldsSchema;
export const updateVehicleLoanSchema = vehicleLoanFieldsSchema.omit({ vehicleId: true }).partial();

export const loanRateChangeSchema = z.object({
  effectiveFrom: day,
  annualRate,
  /** Keep the EMI and change the tenure (the usual bank default), or the reverse. */
  keepEmi: z.boolean().default(true),
});

export const vehicleLoanListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle").optional(),
});

export type CreateVehicleLoanValues = z.output<typeof createVehicleLoanSchema>;
export type CreateVehicleLoanInput = z.input<typeof createVehicleLoanSchema>;
export type UpdateVehicleLoanValues = z.output<typeof updateVehicleLoanSchema>;
export type LoanRateChangeValues = z.output<typeof loanRateChangeSchema>;
export type VehicleLoanListQuery = z.output<typeof vehicleLoanListQuerySchema>;

/** One month of the amortisation schedule. Money is a decimal string. */
export interface LoanScheduleRow {
  number: number;
  date: string;
  annualRate: string;
  openingBalance: string;
  emi: string;
  interest: string;
  principal: string;
  /** Prepayments recorded since the previous EMI (they reduce the balance after this one). */
  prepayment: string;
  closingBalance: string;
  /** From the EMI schedule: paid, skipped, due…; null before tracking started (not known). */
  state: PaymentState | null;
  expenseId: string | null;
}

export interface LoanRateChange {
  id: string;
  effectiveFrom: string;
  annualRate: string;
  keepEmi: boolean;
}

export interface VehicleLoan {
  id: string;
  vehicleId: string;
  lender: string;
  accountNumber: string | null;
  principal: string;
  /** The rate today (after any rate change). */
  annualRate: string;
  tenureMonths: number;
  firstEmiDate: string;
  method: LoanMethod;
  processingFee: string | null;
  /** The EMI today. */
  emi: string;
  /** Per the schedule, after the last EMI due by today. */
  outstanding: string;
  /** From the EMIs and prepayments actually recorded. */
  paid: { principal: string; interest: string; charges: string; emis: number };
  /** EMIs that fell due before the loan was added here (paid outside AutoMate), per schedule. */
  beforeTracking: { emis: number; principal: string; interest: string };
  /** Both together: what the loan has had repaid so far. */
  repaid: { emis: number; principal: string; interest: string };
  emisTotal: number;
  /** The last EMI's date per the schedule (it moves with prepayments and rate changes). */
  endDate: string;
  /** Interest over the whole schedule. */
  totalInterest: string;
  next: { date: string; amount: string; principal: string; interest: string } | null;
  recurringId: string | null;
  rateChanges: LoanRateChange[];
  createdAt: string;
  updatedAt: string;
}
