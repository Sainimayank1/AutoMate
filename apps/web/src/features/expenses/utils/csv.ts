import { type Expense, ExpenseKind } from "@automate/shared";

import { SOURCE_LABELS } from "@/features/expenses/constants";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";

/** One CSV cell: quoted when it holds a comma, quote or line break (RFC 4180). */
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

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
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Saves text as a file through the browser (no upload, nothing leaves the device). */
export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel reads ₹ and other UTF-8 text correctly.
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}
