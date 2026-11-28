import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { blankToNull, positiveDecimal, requiredInt } from "../common/fields.js";
import type { DateWindow } from "../common/periods.js";
import type { ExpenseCategoryRef } from "./expense.schema.js";

/**
 * Budgets (Expenses phase 5, docs/architecture/expenses.md §7): a spending limit for one vehicle
 * per IST month or year, overall or for one main category. Spending counts like "Spent": net of
 * refunds, loan principal left out.
 */

export const BudgetPeriod = { MONTH: "MONTH", YEAR: "YEAR" } as const;
export type BudgetPeriod = (typeof BudgetPeriod)[keyof typeof BudgetPeriod];

/** How the period is going: on track, past the alert threshold, or over the limit. */
export const BudgetState = { ON_TRACK: "ON_TRACK", WARNING: "WARNING", OVER: "OVER" } as const;
export type BudgetState = (typeof BudgetState)[keyof typeof BudgetState];

export const budgetFieldsSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  /** A main category, or none for everything on the vehicle. */
  categoryId: z.preprocess(blankToNull, z.uuid("Choose a category").nullable()).default(null),
  period: z.enum(BudgetPeriod, { error: "Choose monthly or yearly" }).default(BudgetPeriod.MONTH),
  amount: positiveDecimal(10, 2, "Enter the limit, e.g. 8000"),
  /** Warn once spending reaches this % of the limit. */
  alertPercent: requiredInt(1, 100, "Warn at 1 to 100%").default(80),
});

export const createBudgetSchema = budgetFieldsSchema;
export type CreateBudgetValues = z.output<typeof createBudgetSchema>;

/** The vehicle and category can't change: add another budget instead. */
export const updateBudgetSchema = budgetFieldsSchema
  .pick({ period: true, amount: true, alertPercent: true })
  .partial();
export type UpdateBudgetValues = z.output<typeof updateBudgetSchema>;

export const budgetListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle").optional(),
});
export type BudgetListQuery = z.output<typeof budgetListQuerySchema>;

export interface Budget {
  id: string;
  vehicleId: string;
  /** null: everything on the vehicle. */
  category: ExpenseCategoryRef | null;
  period: BudgetPeriod;
  amount: string;
  alertPercent: number;
  /** The current IST month or year, start to end. */
  window: DateWindow;
  spent: string;
  /** Negative once over. */
  remaining: string;
  /** Whole percent of the limit spent (can pass 100). */
  percent: number;
  state: BudgetState;
  createdAt: string;
  updatedAt: string;
}
