import {
  CostClass,
  type Expense,
  type ExpenseCategory,
  ExpenseKind,
  ExpenseSource,
  fromPaise,
  toPaise,
} from "@automate/shared";

import { formatCurrency, formatDate } from "@/utils/format";

/** Not yet refunded: amount − refunded, in exact paise. */
export const remainingRefund = (expense: Expense): string =>
  fromPaise(toPaise(expense.amount) - toPaise(expense.refundedAmount));

/** The delete confirmation's description (Stitch "Delete Expense Dialog"). */
export function deleteText(expense: Expense): string {
  const what = [
    expense.title,
    expense.category.name,
    formatDate(expense.date),
    formatCurrency(expense.amount),
  ].join(" · ");
  const shared = expense.shared
    ? `, with its shares on all ${expense.shared.vehicleCount} vehicles`
    : "";
  return `${what} will be removed with its refunds${shared}. This can't be undone.`;
}

/** A category or subcategory id → the pair an expense stores. */
export function categoryPair(categories: ExpenseCategory[], id: string) {
  for (const category of categories) {
    if (category.id === id) return { category, subcategory: null };
    const subcategory = category.subcategories.find((item) => item.id === id);
    if (subcategory) return { category, subcategory };
  }
  return null;
}

/** Where a linked expense is edited (its source module owns the record). */
export function sourceHref(expense: Expense): string | null {
  if (expense.source === ExpenseSource.FUEL && expense.sourceId) {
    return `/fuel/${expense.vehicleId}/${expense.sourceId}/edit`;
  }
  return null;
}

/** Money can come back for an expense, but not for a loan payment or a refund. */
export const canRefund = (expense: Expense) =>
  expense.kind === ExpenseKind.EXPENSE && expense.category.costClass !== CostClass.FINANCING;
