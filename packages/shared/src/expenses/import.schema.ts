import { z } from "zod";

/**
 * CSV import (Expenses phase 8, docs/architecture/expenses.md §10): the columns the CSV export
 * writes, matched by header in any order, into one vehicle. Previewed first, then committed.
 */

export const IMPORT_MAX_ROWS = 500;
/** Problem rows listed in a preview (the counts cover them all). */
export const IMPORT_PREVIEW_ROWS = 100;

export const expenseImportSchema = z.object({
  vehicleId: z.uuid("Choose a vehicle"),
  csv: z
    .string("Choose a CSV file")
    .min(1, "Choose a CSV file")
    // Inside the API's 100 KB JSON body limit; 500 rows of the export take about 60 KB.
    .max(80_000, "Use a file under 80 KB (about 500 rows)"),
  /** Import rows that look like expenses already recorded too. */
  includeDuplicates: z.boolean().default(false),
});
export type ExpenseImportValues = z.output<typeof expenseImportSchema>;

/** `ready` rows are imported; `duplicate` ones only when asked; `skipped` and `error` never. */
export type ImportRowStatus = "ready" | "duplicate" | "skipped" | "error";

export interface ExpenseImportRow {
  /** The line in the file (the header is line 1). */
  line: number;
  date: string | null;
  title: string;
  amount: string | null;
  category: string | null;
  status: ImportRowStatus;
  /** Why it isn't ready. */
  message: string | null;
}

export interface ExpenseImportPreview {
  counts: Record<ImportRowStatus, number>;
  /** Every row that isn't ready (up to `IMPORT_PREVIEW_ROWS`), then the first ready ones. */
  rows: ExpenseImportRow[];
}

export interface ExpenseImportResult {
  imported: number;
  /** Duplicates left out, skipped rows and rows with errors. */
  notImported: number;
}

/**
 * RFC 4180 CSV to rows of cells: quoted cells may hold commas, quotes ("") and line breaks; CRLF
 * or LF line ends; a leading byte-order mark is dropped; blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
