import { Prisma } from "@/generated/prisma/client";

/**
 * The IRDAI motor-insurance depreciation schedule (5% by 6 months, 15% by a year, then 20, 30, 40
 * and 50% by years 2–5), each step spread evenly over its bracket so a month or a year never shows
 * a jump. After 5 years the schedule stops (values are agreed with the insurer), so it holds.
 */
const SCHEDULE: [months: number, percent: number][] = [
  [0, 0],
  [6, 5],
  [12, 15],
  [24, 20],
  [36, 30],
  [48, 40],
  [60, 50],
];
export const SCHEDULE_MONTHS = 60;

/** Calendar months between two dates, the leftover days as a fraction of an average month. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  return (ty - fy) * 12 + (tm - fm) + (td - fd) / (365.25 / 12);
}

/** Percent of the purchase price lost at an age in months. */
export function depreciationPercent(ageMonths: number): Prisma.Decimal {
  if (ageMonths <= 0) return new Prisma.Decimal(0);
  for (let i = 1; i < SCHEDULE.length; i++) {
    const [toMonths, toPercent] = SCHEDULE[i]!;
    if (ageMonths <= toMonths) {
      const [fromMonths, fromPercent] = SCHEDULE[i - 1]!;
      const share = (ageMonths - fromMonths) / (toMonths - fromMonths);
      return new Prisma.Decimal(fromPercent + (toPercent - fromPercent) * share);
    }
  }
  return new Prisma.Decimal(SCHEDULE.at(-1)![1]);
}

/** What the vehicle lost on the schedule between two dates (rupees, two decimals). */
export function depreciationBetween(
  price: Prisma.Decimal,
  purchased: string,
  from: string,
  to: string,
): Prisma.Decimal {
  const start = from < purchased ? purchased : from;
  if (to <= start) return new Prisma.Decimal(0);
  const lost = depreciationPercent(monthsBetween(purchased, to)).minus(
    depreciationPercent(monthsBetween(purchased, start)),
  );
  return price.mul(lost).div(100).toDecimalPlaces(2);
}
