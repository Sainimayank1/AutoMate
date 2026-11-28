import { addDays, addMonths, BudgetPeriod, BudgetState, type DateWindow } from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";

/** The IST month or year `today` falls in, start to end. */
export function budgetWindow(period: BudgetPeriod, today: string): DateWindow {
  if (period === BudgetPeriod.YEAR) {
    return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  }
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: addDays(addMonths(from, 1), -1) };
}

/**
 * Where spending stands against the limit: whole percent spent (rounded down, so 100 means the
 * whole limit is gone), and the state: over once spending passes the limit, a warning from the
 * alert threshold.
 */
export function budgetProgress(
  amount: Prisma.Decimal,
  spent: Prisma.Decimal,
  alertPercent: number,
) {
  const percent = spent.lte(0) ? 0 : spent.div(amount).mul(100).floor().toNumber();
  const state = spent.gt(amount)
    ? BudgetState.OVER
    : percent >= alertPercent
      ? BudgetState.WARNING
      : BudgetState.ON_TRACK;
  return { remaining: amount.minus(spent), percent, state };
}
