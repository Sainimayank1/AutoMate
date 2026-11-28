import {
  addMonths,
  type Budget,
  BudgetPeriod,
  BudgetState,
  type ExpenseCategoryRef,
  type ExpenseInsight,
  ExpenseInsightKind,
} from "@automate/shared";

import { day, monthName, rupees } from "@/common/format";
import { Prisma } from "@/generated/prisma/client";

/** Below these a difference is noise, not news. */
export const INSIGHT_RULES = {
  /** A category this month against its usual month: this share and this much money above. */
  abovePercent: 25,
  aboveRupees: 500,
  /** Full months the usual month is worked out over, and how many need records. */
  usualMonths: 3,
  minHistory: 2,
  /** A large one-off: this many times the typical expense, and at least this much. */
  largeFactor: 3,
  largeRupees: 2000,
  /** Expenses the typical one is worked out from. */
  largeSample: 10,
} as const;

type Decimal = Prisma.Decimal;
const D = (value: string | number) => new Prisma.Decimal(value);

/** Budgets over their limit, then those past their warning. */
export function budgetInsights(budgets: Budget[], vehicleId: string): ExpenseInsight[] {
  const flagged = budgets.filter((budget) => budget.state !== BudgetState.ON_TRACK);
  flagged.sort(
    (a, b) =>
      Number(b.state === BudgetState.OVER) - Number(a.state === BudgetState.OVER) ||
      b.percent - a.percent,
  );
  return flagged.map((budget) => {
    const name = budget.category?.name ?? "Your overall budget";
    const over = budget.state === BudgetState.OVER;
    const period = budget.period === BudgetPeriod.YEAR ? "this year" : "this month";
    return {
      id: `budget:${budget.id}`,
      kind: ExpenseInsightKind.BUDGET,
      tone: "negative",
      title: over ? `${name} is over budget` : `${name} is near its limit`,
      explanation: over
        ? `${rupees(D(budget.spent))} spent ${period} against a limit of ${rupees(D(budget.amount))}: over by ${rupees(D(budget.remaining).abs())}.`
        : `${rupees(D(budget.spent))} spent ${period}, ${budget.percent}% of the ${rupees(D(budget.amount))} limit. ${rupees(D(budget.remaining))} left.`,
      metric: {
        label: `Spent ${period}`,
        value: rupees(D(budget.spent)),
        compared: `of ${rupees(D(budget.amount))}`,
      },
      action: { label: "View budgets", href: `/expenses/budgets?vehicle=${vehicleId}` },
    };
  });
}

export type MonthRow = { month: string | null; category: ExpenseCategoryRef; total: Decimal };

/**
 * Categories already above their usual month so far: this month against the average of the last
 * full months with records (at least two of three). A category usually at zero isn't flagged, so a
 * yearly premium doesn't read as a surprise.
 */
export function aboveUsual(
  rows: MonthRow[],
  today: string,
  vehicleId: string,
): { items: ExpenseInsight[]; monthsOfHistory: number } {
  const current = today.slice(0, 7);
  const monthStart = `${current}-01`;
  const previous = Array.from({ length: INSIGHT_RULES.usualMonths }, (_, i) =>
    addMonths(monthStart, i - INSIGHT_RULES.usualMonths).slice(0, 7),
  );
  const withRecords = previous.filter((month) => rows.some((row) => row.month === month));
  if (withRecords.length < INSIGHT_RULES.minHistory) {
    return { items: [], monthsOfHistory: withRecords.length };
  }
  const byCategory = new Map<
    string,
    { category: ExpenseCategoryRef; now: Decimal; past: Decimal }
  >();
  for (const row of rows) {
    const entry = byCategory.get(row.category.id) ?? {
      category: row.category,
      now: D(0),
      past: D(0),
    };
    if (row.month === current) entry.now = entry.now.plus(row.total);
    else if (row.month && withRecords.includes(row.month)) entry.past = entry.past.plus(row.total);
    byCategory.set(row.category.id, entry);
  }
  const span = `${monthName(withRecords[0]!)}–${monthName(withRecords.at(-1)!)}`;
  const found: (ExpenseInsight & { excess: Decimal })[] = [];
  for (const { category, now, past } of byCategory.values()) {
    const usual = past.div(withRecords.length).toDecimalPlaces(2);
    const excess = now.minus(usual);
    if (
      usual.lte(0) ||
      excess.lt(INSIGHT_RULES.aboveRupees) ||
      excess.div(usual).times(100).lt(INSIGHT_RULES.abovePercent)
    ) {
      continue;
    }
    found.push({
      id: `above:${category.id}:${current}`,
      kind: ExpenseInsightKind.CATEGORY_ABOVE_USUAL,
      tone: "negative",
      title: `${category.name} is above its usual`,
      explanation: `${rupees(now)} so far this month against ${rupees(usual)} a month on average over ${span}.`,
      metric: {
        label: "This month so far",
        value: rupees(now),
        compared: `${rupees(usual)} a month usually`,
      },
      action: {
        label: "View transactions",
        href: `/expenses/transactions?vehicle=${vehicleId}&category=${category.id}&from=${monthStart}&to=${today}`,
      },
      excess,
    });
  }
  found.sort((a, b) => b.excess.comparedTo(a.excess));
  return {
    items: found.map(({ excess: _excess, ...insight }) => insight),
    monthsOfHistory: withRecords.length,
  };
}

export type DuplicatePair = {
  id: string;
  otherId: string;
  title: string;
  category: string;
  amount: Decimal;
  date: string;
};

/**
 * Two entered expenses alike in vehicle, category, amount and day. Days apart are left alone: a
 * daily parking fee repeats on purpose.
 */
export function duplicateInsights(pairs: DuplicatePair[]): ExpenseInsight[] {
  return pairs.map((pair) => ({
    id: `duplicate:${pair.id}:${pair.otherId}`,
    kind: ExpenseInsightKind.POSSIBLE_DUPLICATE,
    tone: "neutral",
    title: `Possible duplicate: ${pair.title}`,
    explanation: `Two ${rupees(pair.amount)} ${pair.category} expenses on ${day(pair.date)}. If one was entered twice, delete it.`,
    metric: null,
    action: { label: "Review", href: `/expenses/transactions/${pair.otherId}` },
  }));
}

export type LargeCandidate = { id: string; title: string; amount: Decimal; date: string };

/** This month's expenses well above the typical (median) one of the six months before. */
export function largeInsights(
  candidates: LargeCandidate[],
  typical: Decimal | null,
): ExpenseInsight[] {
  if (!typical || typical.lte(0)) return [];
  const floor = Prisma.Decimal.max(
    typical.times(INSIGHT_RULES.largeFactor),
    INSIGHT_RULES.largeRupees,
  );
  return candidates
    .filter((expense) => expense.amount.gte(floor))
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .map((expense) => ({
      id: `large:${expense.id}`,
      kind: ExpenseInsightKind.LARGE_EXPENSE,
      tone: "neutral",
      title: `A large one-off: ${expense.title}`,
      explanation: `${rupees(expense.amount)} on ${day(expense.date)}, about ${expense.amount
        .div(typical)
        .floor()
        .toNumber()}× your typical expense of ${rupees(typical)}.`,
      metric: {
        label: "Amount",
        value: rupees(expense.amount),
        compared: `${rupees(typical)} typical`,
      },
      action: { label: "Review", href: `/expenses/transactions/${expense.id}` },
    }));
}
