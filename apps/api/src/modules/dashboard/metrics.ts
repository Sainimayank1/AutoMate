import {
  type DashboardMetrics,
  FUEL_UNIT,
  type MetricFigure,
  type RecurringPayment,
} from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";
import type { PeriodTotals, Usage } from "@/modules/expenses/expense-figures.service";
import type { FuelInWindow } from "@/modules/fuel/fuel.calculations";

type Decimal = Prisma.Decimal;

/** What the modules report for one window. */
export type WindowFigures = { totals: PeriodTotals; usage: Usage; fuel: FuelInWindow };

/** A figure and its comparison; no percentage against nothing or zero. */
export function compare(
  current: Decimal | null,
  previous: Decimal | null,
  places: number,
): MetricFigure {
  const both = current !== null && previous !== null;
  return {
    value: current?.toFixed(places) ?? null,
    previous: previous?.toFixed(places) ?? null,
    change: both ? current.minus(previous).toFixed(places) : null,
    changePercent:
      both && previous.greaterThan(0)
        ? current.minus(previous).div(previous).times(100).toDecimalPlaces(0).toNumber()
        : null,
  };
}

const km = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));

/**
 * The core metrics for the period vs the window it's compared with. A window with no records has
 * nothing to compare with (null), never a misleading zero; nor does one that records only partly
 * cover (`covered` false: they start inside it), except mileage, whose full-tank cycles are whole.
 */
export function buildMetrics(
  now: WindowFigures,
  before: WindowFigures,
  covered = true,
): Omit<DashboardMetrics, "nextEmi"> {
  const unit = FUEL_UNIT[now.fuel.fuelType];
  const hadFuel = !before.totals.fuel.isZero() || !before.fuel.quantity.isZero();
  return {
    spent: {
      ...compare(
        now.totals.spent,
        covered && before.totals.records ? before.totals.spent : null,
        2,
      ),
      records: now.totals.records,
    },
    runningCostPerKm: compare(now.usage.costPerKm, covered ? before.usage.costPerKm : null, 2),
    mileage: {
      ...compare(now.fuel.mileage, before.fuel.mileage, 2),
      unit: `km/${unit}`,
      cycles: now.fuel.cycles,
    },
    distance: {
      ...compare(km(now.usage.distanceKm), covered ? km(before.usage.distanceKm) : null, 0),
      readings: now.usage.readings,
    },
    fuelSpend: {
      ...compare(now.totals.fuel, covered && hadFuel ? before.totals.fuel : null, 2),
      quantity: now.fuel.quantity.toFixed(2),
      unit,
    },
  };
}

/** The first loan EMI among the upcoming payments (they come overdue first, then soonest). */
export function nextEmi(upcoming: RecurringPayment[]): DashboardMetrics["nextEmi"] {
  const emi = upcoming.find((payment) => payment.loan);
  if (!emi?.loan) return null;
  const { loanId, number, of } = emi.loan;
  return { loanId, date: emi.date, amount: emi.amount, state: emi.state, number, of };
}
