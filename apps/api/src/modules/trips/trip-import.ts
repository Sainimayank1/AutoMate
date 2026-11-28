import type { TripImportField } from "@automate/shared";

import { parseDate } from "@/modules/expenses/expense-import";

/** One file row's cells by trip field ("" when unmapped or empty). */
export type MappedRow = { line: number } & Record<TripImportField, string>;

/**
 * The file's rows read through the column mapping: the header row names the columns. Returns
 * the headers a mapping names that the file doesn't have, instead, when there are any.
 */
export function mapRows(
  table: string[][],
  columns: Partial<Record<TripImportField, string>>,
): MappedRow[] | { unknown: string[] } {
  const [header = [], ...rows] = table;
  const names = header.map((cell) => cell.trim().toLowerCase());
  const index = Object.fromEntries(
    Object.entries(columns).map(([field, name]) => [
      field,
      names.indexOf(name.trim().toLowerCase()),
    ]),
  ) as Partial<Record<TripImportField, number>>;
  const unknown = Object.entries(index)
    .filter(([, at]) => at === -1)
    .map(([field]) => columns[field as TripImportField]!);
  if (unknown.length) return { unknown };
  return rows.map((cells, row) => {
    const cell = (field: TripImportField) => {
      const at = index[field];
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };
    return {
      line: row + 2,
      date: cell("date"),
      endDate: cell("endDate"),
      startTime: cell("startTime"),
      endTime: cell("endTime"),
      type: cell("type"),
      title: cell("title"),
      origin: cell("origin"),
      destination: cell("destination"),
      startKm: cell("startKm"),
      endKm: cell("endKm"),
      distanceKm: cell("distanceKm"),
      notes: cell("notes"),
    };
  });
}

/** "1,234 km" → "1234"; null when it isn't a plain number. */
export function parseKm(value: string): string | null {
  const clean = value.replace(/[,\s]/g, "").replace(/km$/i, "");
  return /^\d+(\.\d+)?$/.test(clean) ? clean : null;
}

/** "6:05" → "06:05"; anything else as written (the trip schema says what's wrong). */
export const parseTime = (value: string) => (/^\d:\d{2}$/.test(value) ? `0${value}` : value);

/** ISO (2026-11-22) or Indian (22/11/2026, 22-11-2026) dates, as the expense import reads them. */
export { parseDate };
