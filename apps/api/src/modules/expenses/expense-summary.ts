import {
  addDays,
  CostClass,
  ExpenseKind,
  type ExpenseSummary,
  ReportingPeriod,
  resolvePeriod,
} from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

/** Net spend per month, vehicle and category (one row per kind: refunds come back separately). */
export type MonthTotal = {
  /** "2026-11" */
  month: string;
  vehicleId: string;
  categoryId: string;
  costClass: CostClass;
  kind: ExpenseKind;
  total: Decimal;
};

/**
 * A vehicle's odometer readings (from expenses, fill-ups included) in a window ("in year" is the
 * window: the year for the Overview, the period for the dashboard).
 */
export type YearReadings = {
  vehicleId: string;
  readings: number;
  minInYear: number | null;
  maxInYear: number | null;
  /** The highest reading before 1 January. */
  before: number | null;
  /** Running cost (net) dated after the first reading this year: used when `before` is unknown. */
  costAfterFirst: Decimal;
};

/** Today in IST and the periods the overview needs (shared period rules). */
export function overviewPeriods(now: Date) {
  const { to: today, previous } = resolvePeriod(ReportingPeriod.THIS_MONTH, now);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return {
    today,
    month: today.slice(0, 7),
    lastMonth: previous.from.slice(0, 7),
    /** The same days of last month: what this month so far is compared with. */
    lastMonthWindow: previous,
    yearStart,
    /** Earliest day queried: January, or last December in January. */
    from: previous.from < yearStart ? previous.from : yearStart,
    /** A day of tolerance, like expense dates themselves (IST/UTC boundary). */
    to: addDays(today, 1),
  };
}

const zero = () => new Decimal(0);
const signed = (row: MonthTotal) =>
  row.kind === ExpenseKind.REFUND ? row.total.negated() : row.total;
const sum = (rows: MonthTotal[]) => rows.reduce((total, row) => total.plus(signed(row)), zero());

/** Distance in the window: the highest reading minus the last one before it (or the first in it). */
export function distanceOf(reading: YearReadings): number | null {
  if (reading.maxInYear === null) return null;
  const start = reading.before ?? (reading.readings >= 2 ? reading.minInYear : null);
  if (start === null) return null;
  const distance = reading.maxInYear - start;
  return distance > 0 ? distance : null;
}

/**
 * The Overview figures (docs/architecture/expenses.md §1). Everything is net of refunds;
 * operating cost is the `OPERATING` class only; cost per km counts only vehicles whose km are known,
 * and without a reading before 1 January only the cost after the year's first reading.
 */
export function summarizeExpenses(
  totals: MonthTotal[],
  readings: YearReadings[],
  now: Date,
  /** Net operating cost over `overviewPeriods(now).lastMonthWindow`. */
  lastMonthSoFar: Decimal,
): Omit<ExpenseSummary, "categories"> & { categories: { categoryId: string; amount: Decimal }[] } {
  const period = overviewPeriods(now);
  const year = period.yearStart.slice(0, 4);
  const operating = totals.filter((row) => row.costClass === CostClass.OPERATING);
  const thisMonthRows = totals.filter((row) => row.month === period.month);
  const opThisMonth = sum(operating.filter((row) => row.month === period.month));
  const opLastMonth = lastMonthSoFar;
  const opYearRows = operating.filter((row) => row.month.startsWith(year));
  const opThisYear = sum(opYearRows);

  const firstMonth = opYearRows.map((row) => row.month).sort()[0];
  const monthsCovered = firstMonth
    ? Number(period.month.slice(5)) - Number(firstMonth.slice(5)) + 1
    : 0;

  const measured = readings.flatMap((reading) => {
    const distance = distanceOf(reading);
    if (distance === null) return [];
    // km counted from the first reading this year: only cost after it paid for them.
    const cost =
      reading.before === null
        ? reading.costAfterFirst
        : sum(opYearRows.filter((row) => row.vehicleId === reading.vehicleId));
    return [{ distance, cost }];
  });
  const distanceKm = measured.reduce((total, item) => total + item.distance, 0);
  const costForMeasured = measured.reduce((total, item) => total.plus(item.cost), zero());

  const byCategory = new Map<string, Decimal>();
  for (const row of operating.filter((item) => item.month === period.month)) {
    byCategory.set(row.categoryId, (byCategory.get(row.categoryId) ?? zero()).plus(signed(row)));
  }
  const categories = [...byCategory.entries()]
    .filter(([, amount]) => amount.greaterThan(0))
    .sort(([, a], [, b]) => b.comparedTo(a))
    .map(([categoryId, amount]) => ({ categoryId, amount }));

  return {
    month: period.month,
    operating: {
      thisMonth: opThisMonth.toFixed(2),
      lastMonth: opLastMonth.toFixed(2),
      lastMonthWindow: period.lastMonthWindow,
      changePercent: opLastMonth.greaterThan(0)
        ? opThisMonth.minus(opLastMonth).div(opLastMonth).times(100).toDecimalPlaces(0).toNumber()
        : null,
      thisYear: opThisYear.toFixed(2),
      monthsCovered,
      monthlyAverage: monthsCovered ? opThisYear.div(monthsCovered).toFixed(2) : null,
    },
    costPerKm: distanceKm > 0 ? costForMeasured.div(distanceKm).toFixed(2) : null,
    distanceKm: distanceKm > 0 ? distanceKm : null,
    loanOutflowThisMonth: sum(
      thisMonthRows.filter((row) => row.costClass === CostClass.FINANCING),
    ).toFixed(2),
    cashOutflowThisMonth: sum(thisMonthRows).toFixed(2),
    categories,
  };
}
