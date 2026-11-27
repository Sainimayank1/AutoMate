import {
  FUELS_FOR_VEHICLE,
  type FuelSummary,
  type FuelType,
  type MileagePoint,
  MileageStatus,
} from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

/** What the calculations read from a fill-up (a `FuelEntry` row satisfies it). */
export type FuelFill = {
  id: string;
  filledAt: Date;
  odometerKm: number;
  fuelType: FuelType;
  quantity: Decimal;
  totalAmount: Decimal;
  isFullTank: boolean;
  missedPrevious: boolean;
};

export type FillMileage = {
  distanceKm: number | null;
  mileage: Decimal | null;
  status: MileageStatus;
};

/** Fuel used between two full tanks: what one mileage figure rests on. */
type Sequence = {
  closedBy: FuelFill;
  distanceKm: number;
  quantity: Decimal;
  cost: Decimal;
  mileage: Decimal;
};

/**
 * History order: by time, then odometer (two fills logged at the same minute), then id, so equal
 * rows always come out the same way and mileage statuses never flip between requests.
 */
export const byHistoryOrder = (a: FuelFill, b: FuelFill) =>
  a.filledAt.getTime() - b.filledAt.getTime() ||
  a.odometerKm - b.odometerKm ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const sum = (values: Decimal[]) =>
  values.reduce((total, value) => total.plus(value), new Decimal(0));

/**
 * Full-tank method: mileage = km between two full tanks ÷ all fuel added after the first, up to and
 * including the second. Partial fills roll into the next full tank. A sequence is only trusted when
 * nothing unseen went into the tank: a missed fill-up, a change of fuel (bi-fuel CNG) or no distance
 * restarts it, and partial fills with no full tank before them never count.
 */
export function computeMileage(fills: FuelFill[]): {
  perFill: Map<string, FillMileage>;
  sequences: Sequence[];
} {
  const perFill = new Map<string, FillMileage>();
  const sequences: Sequence[] = [];
  let previous: FuelFill | null = null;
  let anchor: FuelFill | null = null;
  let partials: FuelFill[] = [];

  const mark = (list: FuelFill[], status: MileageStatus) => {
    for (const fill of list) perFill.get(fill.id)!.status = status;
  };

  for (const fill of [...fills].sort(byHistoryOrder)) {
    const result: FillMileage = {
      distanceKm: previous ? fill.odometerKm - previous.odometerKm : null,
      mileage: null,
      status: MileageStatus.EXCLUDED,
    };
    perFill.set(fill.id, result);
    previous = fill;

    if (fill.missedPrevious || (anchor && fill.fuelType !== anchor.fuelType)) {
      mark(partials, MileageStatus.EXCLUDED);
      anchor = null;
      partials = [];
    }

    if (!fill.isFullTank) {
      if (anchor) {
        result.status = MileageStatus.PENDING;
        partials.push(fill);
      }
      continue;
    }

    const distanceKm = anchor ? fill.odometerKm - anchor.odometerKm : 0;
    if (distanceKm > 0) {
      const used = [...partials, fill];
      const quantity = sum(used.map((item) => item.quantity));
      const mileage = new Decimal(distanceKm).div(quantity).toDecimalPlaces(2);
      result.mileage = mileage;
      result.status = MileageStatus.CALCULATED;
      mark(partials, MileageStatus.ROLLED_IN);
      sequences.push({
        closedBy: fill,
        distanceKm,
        quantity,
        cost: sum(used.map((item) => item.totalAmount)),
        mileage,
      });
    } else {
      result.status = MileageStatus.BASELINE;
      mark(partials, MileageStatus.EXCLUDED);
    }
    anchor = fill;
    partials = [];
  }

  return { perFill, sequences };
}

// shortcut: "this month" follows IST for every user; use the user's timezone once Settings (M11) stores one.
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = (date: Date) => new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
const istMonth = (date: Date) => istDay(date).slice(0, 7);

const TREND_POINTS = 12;

/** The vehicle's fuel figures. Quantity, price and mileage use its primary fuel; spend counts every fill. */
export function summarize(
  fills: FuelFill[],
  vehicleFuelType: FuelType,
  now = new Date(),
): FuelSummary {
  const fuelType = FUELS_FOR_VEHICLE[vehicleFuelType][0];
  const primary = fills.filter((fill) => fill.fuelType === fuelType);
  const sequences = computeMileage(fills).sequences.filter(
    (sequence) => sequence.closedBy.fuelType === fuelType,
  );

  const totalQuantity = sum(primary.map((fill) => fill.quantity));
  const primarySpend = sum(primary.map((fill) => fill.totalAmount));
  const distanceKm = sequences.reduce((total, sequence) => total + sequence.distanceKm, 0);
  const sequenceQuantity = sum(sequences.map((sequence) => sequence.quantity));
  const sequenceCost = sum(sequences.map((sequence) => sequence.cost));

  const point = (sequence: Sequence | undefined): MileagePoint | null =>
    sequence
      ? { date: sequence.closedBy.filledAt.toISOString(), mileage: sequence.mileage.toFixed(2) }
      : null;
  // Stable sort: on a tie, the earliest is worst and the latest is best.
  const ranked = [...sequences].sort((a, b) => a.mileage.comparedTo(b.mileage));

  const month = istMonth(now);
  const thisMonth = fills.filter((fill) => istMonth(fill.filledAt) === month);

  return {
    fuelType,
    fillCount: fills.length,
    totalSpend: sum(fills.map((fill) => fill.totalAmount)).toFixed(2),
    totalQuantity: totalQuantity.toFixed(3),
    averagePrice: totalQuantity.isZero() ? null : primarySpend.div(totalQuantity).toFixed(2),
    averageMileage: sequences.length
      ? new Decimal(distanceKm).div(sequenceQuantity).toFixed(2)
      : null,
    mileageSequences: sequences.length,
    lastMileage: point(sequences.at(-1)),
    bestMileage: point(ranked.at(-1)),
    worstMileage: point(ranked[0]),
    costPerKm: distanceKm ? sequenceCost.div(distanceKm).toFixed(2) : null,
    thisMonth: {
      spend: sum(thisMonth.map((fill) => fill.totalAmount)).toFixed(2),
      fillCount: thisMonth.length,
      quantity: sum(
        thisMonth.filter((fill) => fill.fuelType === fuelType).map((fill) => fill.quantity),
      ).toFixed(3),
    },
    trend: sequences.slice(-TREND_POINTS).map((sequence) => point(sequence)!),
  };
}

/** Fuel over an IST window, in the vehicle's primary fuel (its unit). */
export type FuelInWindow = {
  fuelType: FuelType;
  /** km per unit over full-tank sequences that closed in the window; null with none. */
  mileage: Decimal | null;
  /** How many full-tank sequences the mileage rests on. */
  cycles: number;
  /** Quantity of the primary fuel bought in the window, and what it cost (fill-up totals). */
  quantity: Decimal;
  spend: Decimal;
  /** Over those cycles: fuel cost ÷ km. */
  costPerKm: Decimal | null;
  /** The latest cycle closed by the window's end, and up to 12 of them (oldest first). */
  latest: MileagePoint | null;
  trend: MileagePoint[];
};

/**
 * The window's share of the full-tank engine: sequences are worked out over the whole history (a
 * cycle can start before the window) and counted in the window they close in.
 */
export function fuelInWindow(
  fills: FuelFill[],
  vehicleFuelType: FuelType,
  window: { from: string; to: string },
): FuelInWindow {
  const fuelType = FUELS_FOR_VEHICLE[vehicleFuelType][0];
  const inWindow = (instant: Date) => {
    const day = istDay(instant);
    return day >= window.from && day <= window.to;
  };
  const primary = computeMileage(fills).sequences.filter(
    (sequence) => sequence.closedBy.fuelType === fuelType,
  );
  const sequences = primary.filter((sequence) => inWindow(sequence.closedBy.filledAt));
  const upToEnd = primary.filter((sequence) => istDay(sequence.closedBy.filledAt) <= window.to);
  const distanceKm = sequences.reduce((total, sequence) => total + sequence.distanceKm, 0);
  const bought = fills.filter((fill) => fill.fuelType === fuelType && inWindow(fill.filledAt));
  const point = (sequence: Sequence): MileagePoint => ({
    date: sequence.closedBy.filledAt.toISOString(),
    mileage: sequence.mileage.toFixed(2),
  });
  return {
    fuelType,
    mileage: sequences.length
      ? new Decimal(distanceKm).div(sum(sequences.map((sequence) => sequence.quantity)))
      : null,
    cycles: sequences.length,
    quantity: sum(bought.map((fill) => fill.quantity)),
    spend: sum(bought.map((fill) => fill.totalAmount)),
    costPerKm: distanceKm ? sum(sequences.map((sequence) => sequence.cost)).div(distanceKm) : null,
    latest: upToEnd.length ? point(upToEnd.at(-1)!) : null,
    trend: upToEnd.slice(-12).map(point),
  };
}
