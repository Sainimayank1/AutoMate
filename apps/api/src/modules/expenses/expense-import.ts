import { PaymentMethod } from "@automate/shared";

/** One data row of an import, its cells by meaning (blank when the column isn't there). */
export type RawRow = {
  line: number;
  date: string;
  title: string;
  category: string;
  subcategory: string;
  amount: string;
  payment: string;
  vendor: string;
  source: string;
  notes: string;
};
type Field = Exclude<keyof RawRow, "line">;

/** Header names per field, lower case: the export's first, then common alternatives. */
const HEADERS: Record<Field, string[]> = {
  date: ["date"],
  title: ["title", "description"],
  category: ["category"],
  subcategory: ["subcategory"],
  amount: ["amount (inr)", "amount"],
  payment: ["payment method", "payment"],
  vendor: ["vendor"],
  source: ["source"],
  notes: ["notes"],
};
const REQUIRED: Field[] = ["date", "title", "category", "amount"];

/** The header row maps columns to fields; the rest become rows (line numbers from 2). */
export function readRows(table: string[][]): RawRow[] | { missing: string[] } {
  const [header = [], ...data] = table;
  const names = header.map((name) => name.trim().toLowerCase());
  const index = Object.fromEntries(
    (Object.keys(HEADERS) as Field[]).map((field) => [
      field,
      names.findIndex((name) => HEADERS[field].includes(name)),
    ]),
  ) as Record<Field, number>;
  const missing = REQUIRED.filter((field) => index[field] < 0);
  if (missing.length) return { missing: missing.map((field) => HEADERS[field][0]!) };
  return data.map((cells, i) => {
    const cell = (field: Field) => (index[field] < 0 ? "" : (cells[index[field]] ?? "").trim());
    return {
      line: i + 2,
      date: cell("date"),
      title: cell("title"),
      category: cell("category"),
      subcategory: cell("subcategory"),
      amount: cell("amount"),
      payment: cell("payment"),
      vendor: cell("vendor"),
      source: cell("source"),
      notes: cell("notes"),
    };
  });
}

/** "2026-11-21", "21/11/2026" or "21-11-2026" (Indian day first) to ISO; null if not a real date. */
export function parseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const indian = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  const [year, month, day] = iso
    ? [iso[1]!, iso[2]!, iso[3]!]
    : indian
      ? [indian[3]!, indian[2]!.padStart(2, "0"), indian[1]!.padStart(2, "0")]
      : [];
  if (!year) return null;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

/** "₹1,500.00" to "1500.00"; a negative amount is a refund (exported refunds are negative). */
export function parseAmount(value: string): { amount: string } | "refund" | null {
  const clean = value.replace(/[₹,\s]/g, "").replace(/^INR/i, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  return clean.startsWith("-") ? "refund" : { amount: clean };
}

const squash = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");

/** A payment method by its value or label ("Net banking", "NET_BANKING"); null when blank. */
export function parsePayment(value: string): PaymentMethod | null | "unknown" {
  if (!value) return null;
  return (
    Object.values(PaymentMethod).find((method) => squash(method) === squash(value)) ?? "unknown"
  );
}

/** Rows the export marks as coming from another module are already linked there. */
export const isLinkedSource = (source: string) =>
  !!source && !["manual", "imported", "import"].includes(source.trim().toLowerCase());
