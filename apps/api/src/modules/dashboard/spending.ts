import {
  addMonths,
  type DateWindow,
  type DrivingOverview,
  type ExpenseCategoryRef,
  FUEL_UNIT,
  type FuelOverview,
  SpendGroup,
  spendGroupOf,
  type SpendingOverview,
} from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";
import type { FuelInWindow } from "@/modules/fuel/fuel.calculations";

/** Net spending of one top-level category (in one month when split by month). */
export type CategoryRow = {
  month: string | null;
  category: ExpenseCategoryRef;
  total: Prisma.Decimal;
};

const zero = () => new Prisma.Decimal(0);

/** The months the spending trend shows: 6 ending with the period's last month, up to 12. */
export function trendMonths(period: DateWindow): string[] {
  const index = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  const spanned = index(period.to) - index(period.from) + 1;
  const count = Math.min(Math.max(spanned, 6), 12);
  const last = `${period.to.slice(0, 7)}-01`;
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1).slice(0, 7));
}

/**
 * The spending section: the period by category (largest first, shares of what was spent) and the
 * months around it in the five chart groups. Amounts arrive net and without loan principal.
 */
export function spendingOverview(
  period: CategoryRow[],
  monthly: CategoryRow[],
  months: string[],
): SpendingOverview {
  const total = period.reduce((sum, row) => sum.plus(row.total), zero());
  const spent = period.filter((row) => row.total.greaterThan(0));
  const positive = spent.reduce((sum, row) => sum.plus(row.total), zero());
  return {
    total: total.toFixed(2),
    categories: spent
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((row) => ({
        category: row.category,
        amount: row.total.toFixed(2),
        percent: row.total.div(positive).times(100).toDecimalPlaces(1).toNumber(),
      })),
    months: months.map((month) => {
      const groups = Object.fromEntries(
        Object.values(SpendGroup).map((group) => [group, zero()]),
      ) as Record<SpendGroup, Prisma.Decimal>;
      for (const row of monthly.filter((item) => item.month === month)) {
        const group = spendGroupOf(row.category.key);
        groups[group] = groups[group].plus(row.total);
      }
      const sum = Object.values(groups).reduce((all, value) => all.plus(value), zero());
      return {
        month,
        total: sum.toFixed(2),
        groups: Object.fromEntries(
          Object.entries(groups).map(([group, value]) => [group, value.toFixed(2)]),
        ) as Record<SpendGroup, string>,
      };
    }),
  };
}

/** The fuel section from the engine's window figures and the period's net fuel spend. */
export function fuelOverview(fuel: FuelInWindow, netSpend: Prisma.Decimal): FuelOverview {
  const unit = FUEL_UNIT[fuel.fuelType];
  return {
    fuelType: fuel.fuelType,
    unit,
    mileageUnit: `km/${unit}`,
    averageMileage: fuel.mileage?.toFixed(2) ?? null,
    cycles: fuel.cycles,
    latestMileage: fuel.latest,
    quantity: fuel.quantity.toFixed(2),
    spend: netSpend.toFixed(2),
    averagePrice: fuel.quantity.isZero() ? null : fuel.spend.div(fuel.quantity).toFixed(2),
    costPerKm: fuel.costPerKm?.toFixed(2) ?? null,
    trend: fuel.trend,
  };
}

/**
 * The driving card from odometer readings: km per day over the period so far (a period ending
 * in the future counts only to today).
 */
export function drivingOverview(
  usage: { readings: number; distanceKm: number | null },
  lastReading: { km: number; date: string } | null,
  period: DateWindow,
  today: string,
): Omit<DrivingOverview, "trips"> | null {
  if (!usage.readings && !lastReading) return null;
  const end = period.to < today ? period.to : today;
  const days = Math.round((Date.parse(end) - Date.parse(period.from)) / 86_400_000) + 1;
  return {
    distanceKm: usage.distanceKm,
    readings: usage.readings,
    perDay:
      usage.distanceKm && days > 0
        ? new Prisma.Decimal(usage.distanceKm).div(days).toFixed(1)
        : null,
    lastReading,
  };
}
