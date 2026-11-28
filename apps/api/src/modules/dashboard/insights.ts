import {
  type DashboardInsights,
  FUEL_UNIT,
  type Insight,
  INSIGHT_LIMIT,
  type InsightConfidence,
  type InsightNeed,
  type InsightTone,
  istToday,
  type MileagePoint,
  type PeriodWindow,
  SpendGroup,
  spendGroupOf,
} from "@automate/shared";

import { km, monthName, rupees } from "@/common/format";
import { Prisma } from "@/generated/prisma/client";

import type { WindowFigures } from "./metrics";
import type { CategoryRow } from "./spending";

type Decimal = Prisma.Decimal;

/** Below these a change is noise, not news. */
export const THRESHOLDS = {
  /** Spending: this share and this much money. */
  spendPercent: 10,
  spendRupees: 500,
  fuelCostPercent: 10,
  mileagePercent: 5,
  distancePercent: 15,
  distanceKm: 100,
  /** Full tanks, or months, in a row. */
  run: 3,
  /** How far mileage must fall over the run. */
  runDropPercent: 5,
} as const;

export type InsightInputs = {
  vehicleId: string;
  window: PeriodWindow;
  /**
   * From the metrics: both windows and the date records start; null when the vehicle has no
   * fill-up or expense.
   */
  figures: { now: WindowFigures; before: WindowFigures; since: string } | null;
  /** From the spending section: both windows by category and the trend months. */
  spending: {
    inPeriod: CategoryRow[];
    previous: CategoryRow[];
    monthly: CategoryRow[];
    months: string[];
  } | null;
};

type Found = Insight & { weight: number };
/** A rule finds an insight, finds nothing notable (null) or lacks the records to tell. */
type Outcome = Found | InsightNeed | null;

const TONE_RANK: Record<InsightTone, number> = { negative: 0, positive: 1, neutral: 2 };

const percent = (now: Decimal, before: Decimal) =>
  now.minus(before).div(before).times(100).toDecimalPlaces(0).toNumber();
const confidence = (count: number, high: number): InsightConfidence =>
  count >= high ? "high" : count >= 2 ? "medium" : "low";
const cycles = (count: number) => `${count} full-tank cycle${count === 1 ? "" : "s"}`;
const soFar = (window: PeriodWindow) => (window.endsToday ? " so far" : "");

/**
 * Smart insights (docs/architecture/dashboard.md §1): fixed rules over figures other sections
 * already have, never AI and never a number of its own. Costs and worse running rank first, then
 * improvements, then the rest, the biggest change first, one per topic.
 */
export function buildInsights(inputs: InsightInputs): DashboardInsights {
  if (!inputs.figures) return { items: [], needs: ["expenses", "fuel_cycles", "odometer"] };
  const outcomes: Outcome[] = [
    spendingChange(inputs),
    fuelCost(inputs),
    mileageChange(inputs),
    mileageRun(inputs),
    distanceChange(inputs),
    maintenanceRun(inputs),
  ];
  const found = outcomes
    .filter((outcome): outcome is Found => typeof outcome === "object" && outcome !== null)
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || b.weight - a.weight)
    .filter((item, index, all) => all.findIndex((other) => other.topic === item.topic) === index)
    .slice(0, INSIGHT_LIMIT);
  const covered = new Set(found.map((item) => item.topic));
  const needs = [
    ...new Set(outcomes.filter((outcome): outcome is InsightNeed => typeof outcome === "string")),
  ].filter((need) => !covered.has(NEED_TOPIC[need]));
  return { items: found.map(({ weight: _weight, ...item }) => item), needs };
}

const NEED_TOPIC: Record<InsightNeed, Insight["topic"]> = {
  expenses: "spending",
  fuel_cycles: "fuel",
  odometer: "usage",
};

/**
 * Spent (net, no loan principal) vs the comparison window, and the category that moved most. Only
 * once records cover that whole window: one that starts before them isn't "spending less".
 */
function spendingChange({ figures, spending, window, vehicleId }: InsightInputs): Outcome {
  const { now, before, since } = figures!;
  if (
    since > window.previous.from ||
    !now.totals.records ||
    !before.totals.records ||
    !before.totals.spent.greaterThan(0)
  ) {
    return "expenses";
  }
  const change = now.totals.spent.minus(before.totals.spent);
  const by = percent(now.totals.spent, before.totals.spent);
  if (Math.abs(by) < THRESHOLDS.spendPercent || change.abs().lessThan(THRESHOLDS.spendRupees)) {
    return null;
  }
  const up = change.greaterThan(0);
  const mover = spending && biggestMove(spending.inPeriod, spending.previous, up);
  return {
    id: "spending_change",
    topic: "spending",
    tone: up ? "negative" : "positive",
    title: `Spending is ${up ? "up" : "down"} ${Math.abs(by)}%`,
    explanation:
      `${rupees(now.totals.spent)}${soFar(window)} against ${rupees(before.totals.spent)}.` +
      (mover
        ? ` ${mover.name} ${up ? "rose" : "fell"} the most: ${up ? "+" : "−"}${rupees(mover.by.abs())}.`
        : ""),
    metric: {
      label: "Spent",
      value: rupees(now.totals.spent),
      previous: rupees(before.totals.spent),
    },
    comparedWith: window.previous,
    confidence: null,
    action: {
      label: "View transactions",
      href: `/expenses/transactions?${new URLSearchParams({ vehicle: vehicleId, from: window.from, to: window.to }).toString()}`,
    },
    weight: Math.abs(by),
  };
}

/** The top-level category whose spending rose (or fell) the most between the windows. */
function biggestMove(now: CategoryRow[], before: CategoryRow[], up: boolean) {
  const moves = new Map<string, { name: string; by: Decimal }>();
  for (const row of now) moves.set(row.category.id, { name: row.category.name, by: row.total });
  for (const row of before) {
    const move = moves.get(row.category.id);
    moves.set(row.category.id, {
      name: row.category.name,
      by: (move?.by ?? new Prisma.Decimal(0)).minus(row.total),
    });
  }
  const [top] = [...moves.values()]
    .filter((move) => (up ? move.by.greaterThan(0) : move.by.lessThan(0)))
    .sort((a, b) => (up ? b.by.comparedTo(a.by) : a.by.comparedTo(b.by)));
  return top ?? null;
}

/** Fuel cost per km over full-tank cycles (immune to when the tank was filled), with why. */
function fuelCost({ figures, window }: InsightInputs): Outcome {
  const { now, before } = figures!;
  const [a, b] = [now.fuel.costPerKm, before.fuel.costPerKm];
  if (!a || !b || !b.greaterThan(0)) return "fuel_cycles";
  const by = percent(a, b);
  if (Math.abs(by) < THRESHOLDS.fuelCostPercent) return null;
  const unit = FUEL_UNIT[now.fuel.fuelType];
  const price = (fuel: WindowFigures["fuel"]) =>
    fuel.quantity.isZero() ? null : fuel.spend.div(fuel.quantity);
  const [priceNow, priceBefore] = [price(now.fuel), price(before.fuel)];
  return {
    id: "fuel_cost_per_km",
    topic: "fuel",
    tone: by > 0 ? "negative" : "positive",
    title: `Fuel costs ${Math.abs(by)}% ${by > 0 ? "more" : "less"} per km`,
    explanation:
      `${rupees(a)} a km against ${rupees(b)}, over full-tank cycles. Mileage ` +
      `${now.fuel.mileage!.toFixed(1)} against ${before.fuel.mileage!.toFixed(1)} km/${unit}` +
      (priceNow && priceBefore
        ? `; you paid ${rupees(priceNow)} against ${rupees(priceBefore)} per ${unit}.`
        : "."),
    metric: { label: "Fuel cost / km", value: rupees(a), previous: rupees(b) },
    comparedWith: window.previous,
    confidence: confidence(Math.min(now.fuel.cycles, before.fuel.cycles), 3),
    action: { label: "View fuel", href: "/fuel" },
    weight: Math.abs(by),
  };
}

/** Average mileage over the full-tank cycles that closed in each window. */
function mileageChange({ figures, window }: InsightInputs): Outcome {
  const { now, before } = figures!;
  const [a, b] = [now.fuel.mileage, before.fuel.mileage];
  if (!a || !b) return "fuel_cycles";
  const by = percent(a, b);
  if (Math.abs(by) < THRESHOLDS.mileagePercent) return null;
  const unit = `km/${FUEL_UNIT[now.fuel.fuelType]}`;
  return {
    id: "mileage_change",
    topic: "fuel",
    tone: by > 0 ? "positive" : "negative",
    title: `Mileage ${by > 0 ? "improved" : "dropped"} ${Math.abs(by)}%`,
    explanation:
      `${a.toFixed(1)} ${unit} over ${cycles(now.fuel.cycles)} against ` +
      `${b.toFixed(1)} ${unit} over ${cycles(before.fuel.cycles)}.`,
    metric: {
      label: "Average mileage",
      value: `${a.toFixed(1)} ${unit}`,
      previous: `${b.toFixed(1)} ${unit}`,
    },
    comparedWith: window.previous,
    confidence: confidence(Math.min(now.fuel.cycles, before.fuel.cycles), 3),
    action: { label: "View fuel", href: "/fuel" },
    weight: Math.abs(by),
  };
}

/** Mileage falling over the latest full tanks, the last of them in the period. */
function mileageRun({ figures, window }: InsightInputs): Outcome {
  const { trend, fuelType } = figures!.now.fuel;
  const last = trend.at(-1);
  if (!last || istToday(new Date(last.date)) < window.from) return null;
  let run: MileagePoint[] = [last];
  for (let i = trend.length - 2; i >= 0; i--) {
    if (!new Prisma.Decimal(trend[i]!.mileage).greaterThan(run[0]!.mileage)) break;
    run = [trend[i]!, ...run];
  }
  if (run.length < THRESHOLDS.run) return null;
  const [first, latest] = [new Prisma.Decimal(run[0]!.mileage), new Prisma.Decimal(last.mileage)];
  const by = percent(latest, first);
  if (-by < THRESHOLDS.runDropPercent) return null;
  const unit = `km/${FUEL_UNIT[fuelType]}`;
  const values = run.map((point) => new Prisma.Decimal(point.mileage).toFixed(1));
  return {
    id: "mileage_falling",
    topic: "fuel",
    tone: "negative",
    title: `Mileage fell over the last ${run.length} full tanks`,
    explanation: `${values.slice(0, -1).join(", ")} then ${values.at(-1)} ${unit}: ${-by}% lower.`,
    metric: {
      label: "Latest mileage",
      value: `${latest.toFixed(1)} ${unit}`,
      previous: `${first.toFixed(1)} ${unit}`,
    },
    comparedWith: null,
    confidence: "medium",
    action: { label: "View fuel history", href: "/fuel" },
    weight: -by,
  };
}

/** Odometer distance vs the comparison window, once readings cover all of it. */
function distanceChange({ figures, window, vehicleId }: InsightInputs): Outcome {
  const { now, before, since } = figures!;
  const [a, b] = [now.usage.distanceKm, before.usage.distanceKm];
  if (a === null || b === null || since > window.previous.from) return "odometer";
  if (b <= 0) return null;
  const by = percent(new Prisma.Decimal(a), new Prisma.Decimal(b));
  if (Math.abs(by) < THRESHOLDS.distancePercent || Math.abs(a - b) < THRESHOLDS.distanceKm) {
    return null;
  }
  return {
    id: "distance_change",
    topic: "usage",
    tone: "neutral",
    title: `You drove ${Math.abs(by)}% ${by > 0 ? "more" : "less"}`,
    explanation: `${km(a)}${soFar(window)} against ${km(b)}, from odometer readings.`,
    metric: { label: "Distance", value: km(a), previous: km(b) },
    comparedWith: window.previous,
    confidence: confidence(Math.min(now.usage.readings, before.usage.readings), 4),
    action: { label: "View vehicle", href: `/garage/${vehicleId}` },
    weight: Math.abs(by),
  };
}

/** Maintenance and repairs spending rising month after month, up to the period's month. */
function maintenanceRun({ spending, window }: InsightInputs): Outcome {
  if (!spending) return null;
  const months = spending.months.slice(-THRESHOLDS.run);
  const totals = months.map((month) =>
    spending.monthly
      .filter(
        (row) => row.month === month && spendGroupOf(row.category.key) === SpendGroup.MAINTENANCE,
      )
      .reduce((sum, row) => sum.plus(row.total), new Prisma.Decimal(0)),
  );
  if (totals.length < THRESHOLDS.run || !totals[0]!.greaterThan(0)) return null;
  if (!totals.every((total, i) => i === 0 || total.greaterThan(totals[i - 1]!))) return null;
  const [first, last] = [totals[0]!, totals.at(-1)!];
  const parts = months.map((month, i) => `${rupees(totals[i]!)} in ${monthName(month)}`);
  return {
    id: "maintenance_rising",
    topic: "maintenance",
    tone: "negative",
    title: `Maintenance costs rose ${months.length} months running`,
    explanation: `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}${soFar(window)}.`,
    metric: { label: "Maintenance & repairs", value: rupees(last), previous: rupees(first) },
    comparedWith: null,
    confidence: null,
    action: { label: "View maintenance", href: "/maintenance" },
    weight: percent(last, first),
  };
}
