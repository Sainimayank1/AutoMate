import { addMonths, type DateWindow, type MaintenanceSpend } from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";

/** The expense categories whose spending is maintenance spending (system top-level keys). */
export const SPEND_CATEGORY_KEYS = ["MAINTENANCE", "REPAIRS"];

type SpendRow = { month: string; categoryKey: string; total: Prisma.Decimal };

/** "YYYY-MM" of every month the window touches, in order. */
export function monthsIn({ from, to }: DateWindow): string[] {
  const months: string[] = [];
  for (let month = from.slice(0, 7); month <= to.slice(0, 7);) {
    months.push(month);
    month = addMonths(`${month}-01`, 1).slice(0, 7);
  }
  return months;
}

const total = (rows: SpendRow[]) =>
  rows.reduce((sum, row) => sum.plus(row.total), new Prisma.Decimal(0));

/** Spending of the window (every month listed, zero when nothing was spent) and its previous window. */
export function summarizeSpend(
  current: SpendRow[],
  previous: SpendRow[],
  window: DateWindow,
): MaintenanceSpend {
  const of = (key: string, month?: string) =>
    total(current.filter((row) => row.categoryKey === key && (!month || row.month === month)));
  const maintenance = of("MAINTENANCE");
  const repairs = of("REPAIRS");
  return {
    total: maintenance.plus(repairs).toFixed(2),
    maintenance: maintenance.toFixed(2),
    repairs: repairs.toFixed(2),
    previousTotal: total(previous).toFixed(2),
    months: monthsIn(window).map((month) => ({
      month,
      maintenance: of("MAINTENANCE", month).toFixed(2),
      repairs: of("REPAIRS", month).toFixed(2),
    })),
  };
}
