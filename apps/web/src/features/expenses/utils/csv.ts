import { type Expense, ExpenseKind } from "@automate/shared";

import { SOURCE_LABELS } from "@/features/expenses/constants";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { toCsv } from "@/utils/csv";

/** Expenses as CSV. Refunds are negative, so a column sum is net spending. Dates stay ISO. */
export function expensesToCsv(expenses: Expense[], vehicleLabel: (id: string) => string): string {
  const header = [
    "Date",
    "Title",
    "Category",
    "Subcategory",
    "Vehicle",
    "Amount (INR)",
    "Payment method",
    "Vendor",
    "Source",
    "Notes",
  ];
  const rows = expenses.map((expense) => [
    expense.date,
    expense.title,
    expense.category.name,
    expense.subcategory?.name,
    vehicleLabel(expense.vehicleId),
    expense.kind === ExpenseKind.REFUND ? `-${expense.amount}` : expense.amount,
    expense.paymentMethod && PAYMENT_METHOD_LABELS[expense.paymentMethod],
    expense.vendor,
    SOURCE_LABELS[expense.source],
    expense.notes,
  ]);
  return toCsv([header, ...rows]);
}
