import { z } from "zod";

/**
 * Expense insights (Expenses phase 7, docs/architecture/expenses.md §9): fixed rules over one
 * vehicle's own records, never AI. The dashboard's smart insights cover period-over-period changes;
 * these cover budgets, categories against their usual month, likely duplicates and large one-offs.
 */

export const ExpenseInsightKind = {
  BUDGET: "budget",
  CATEGORY_ABOVE_USUAL: "category_above_usual",
  POSSIBLE_DUPLICATE: "possible_duplicate",
  LARGE_EXPENSE: "large_expense",
} as const;
export type ExpenseInsightKind = (typeof ExpenseInsightKind)[keyof typeof ExpenseInsightKind];

export const expenseInsightsQuerySchema = z.object({ vehicleId: z.uuid("Choose a vehicle") });
export type ExpenseInsightsQuery = z.output<typeof expenseInsightsQuerySchema>;

export interface ExpenseInsight {
  /** Stable for the same finding (the rule and what it's about). */
  id: string;
  kind: ExpenseInsightKind;
  /** `negative`: money over a limit or the usual; `neutral`: worth a look. */
  tone: "negative" | "neutral";
  title: string;
  explanation: string;
  /** The figure it rests on and what it's compared with, formatted. */
  metric: { label: string; value: string; compared: string | null } | null;
  action: { label: string; href: string };
}

export interface ExpenseInsights {
  /** Over a limit first, then above the usual, then worth a look; at most `EXPENSE_INSIGHT_LIMIT`. */
  items: ExpenseInsight[];
  /** Full months before this one with records: comparisons with the usual need two. */
  monthsOfHistory: number;
}

export const EXPENSE_INSIGHT_LIMIT = 8;
