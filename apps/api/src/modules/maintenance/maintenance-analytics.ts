import { type DateWindow, daysBetween, type MaintenanceAnalytics } from "@automate/shared";

import { km, rupees } from "@/common/format";
import { Prisma, ServiceRecordType } from "@/generated/prisma/client";

import { summarizeSpend } from "./maintenance-spend";

type SpendRow = { month: string; categoryKey: string; total: Prisma.Decimal };

const REPAIR_TYPES: ServiceRecordType[] = [
  ServiceRecordType.REPAIR,
  ServiceRecordType.EMERGENCY_REPAIR,
  ServiceRecordType.WARRANTY_REPAIR,
];

export interface AnalyticsInput {
  window: DateWindow;
  /** Expenses' Maintenance and Repairs spending by month, in the window and the one before. */
  current: SpendRow[];
  previous: SpendRow[];
  /** The same spending by subcategory (its parent's name when it has none). */
  categories: { name: string; total: Prisma.Decimal }[];
  /** Service records in the window. */
  records: { date: string; odometerKm: number | null; type: ServiceRecordType }[];
  replacements: {
    name: string;
    replacedOn: string;
    replacedKm: number | null;
    installedKm: number | null;
    expectedLifeKm: number | null;
  }[];
  distanceKm: number | null;
  comparison: MaintenanceAnalytics["comparison"];
}

const ZERO = new Prisma.Decimal(0);
const sum = (rows: { total: Prisma.Decimal }[]) =>
  rows.reduce((total, row) => total.plus(row.total), ZERO);
const percentOf = (part: Prisma.Decimal, whole: Prisma.Decimal) =>
  whole.isZero() ? 0 : part.div(whole).times(100).toDecimalPlaces(0).toNumber();
const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

/** Gaps between service visits (records on the same day are one visit). */
export function serviceFrequency(records: AnalyticsInput["records"]) {
  const visits = new Map<string, number | null>();
  for (const record of records) {
    const km = visits.get(record.date) ?? null;
    visits.set(record.date, record.odometerKm === null ? km : Math.max(km ?? 0, record.odometerKm));
  }
  const dated = [...visits.entries()].sort(([a], [b]) => a.localeCompare(b));
  const days: number[] = [];
  const kms: number[] = [];
  for (let at = 1; at < dated.length; at++) {
    const [before, beforeKm] = dated[at - 1]!;
    const [date, odometer] = dated[at]!;
    days.push(daysBetween(before, date));
    if (beforeKm !== null && odometer !== null && odometer >= beforeKm)
      kms.push(odometer - beforeKm);
  }
  return { averageDays: average(days), averageKm: average(kms), intervals: days.length };
}

/**
 * The Analytics tab from figures each module owns (pure; maintenance-analytics.spec.ts): spending
 * from Expenses, visits from service records, replacements from tracked parts. Insights are fixed
 * rules over these numbers, so they only say what the records show.
 */
export function buildAnalytics(input: AnalyticsInput): MaintenanceAnalytics {
  const spend = summarizeSpend(input.current, input.previous, input.window);
  const total = new Prisma.Decimal(spend.total);
  const repairs = new Prisma.Decimal(spend.repairs);
  const services = input.records.length;
  const repairVisits = input.records.filter((record) => REPAIR_TYPES.includes(record.type)).length;
  const categoryTotal = sum(input.categories);
  const replacements = input.replacements
    .map((part) => {
      const lifeKm =
        part.replacedKm !== null && part.installedKm !== null && part.replacedKm >= part.installedKm
          ? part.replacedKm - part.installedKm
          : null;
      return {
        name: part.name,
        replacedOn: part.replacedOn,
        replacedKm: part.replacedKm,
        lifeKm,
        expectedLifeKm: part.expectedLifeKm,
        percentOfLife:
          lifeKm !== null && part.expectedLifeKm
            ? Math.round((lifeKm / part.expectedLifeKm) * 100)
            : null,
      };
    })
    .sort((a, b) => b.replacedOn.localeCompare(a.replacedOn));
  const frequency = serviceFrequency(input.records);

  const insights: string[] = [];
  const previousTotal = sum(input.previous);
  const share = percentOf(repairs, total);
  if (total.gt(0) && previousTotal.gt(0)) {
    const before = percentOf(
      sum(input.previous.filter((row) => row.categoryKey === "REPAIRS")),
      previousTotal,
    );
    const trend =
      share === before ? "the same as" : `${share > before ? "up" : "down"} from ${before}% in`;
    insights.push(`Repairs were ${share}% of maintenance spend, ${trend} the period before.`);
    const change = percentOf(total.minus(previousTotal).abs(), previousTotal);
    if (change > 0) {
      insights.push(
        `Maintenance spend is ${change}% ${total.gt(previousTotal) ? "higher" : "lower"} than the period before (${rupees(total)} against ${rupees(previousTotal)}).`,
      );
    }
  } else if (total.gt(0)) {
    insights.push(`Repairs were ${share}% of maintenance spend.`);
  }
  const measured = replacements.find((part) => part.percentOfLife !== null);
  if (measured) {
    insights.push(
      `${measured.name} was replaced at ${measured.percentOfLife}% of its estimated life (${km(measured.lifeKm!)} of ${km(measured.expectedLifeKm!)}).`,
    );
  }
  if (frequency.averageDays !== null) {
    insights.push(
      `On average, ${frequency.averageDays} days${frequency.averageKm !== null ? ` and ${km(frequency.averageKm)}` : ""} passed between services.`,
    );
  }

  return {
    period: input.window,
    totals: {
      spend: spend.total,
      maintenance: spend.maintenance,
      repairs: spend.repairs,
      services,
      repairVisits,
      averagePerService: services ? total.div(services).toFixed(2) : null,
      distanceKm: input.distanceKm,
      costPerKm: input.distanceKm ? total.div(input.distanceKm).toFixed(2) : null,
    },
    months: spend.months,
    categories: input.categories
      .filter((row) => row.total.gt(0))
      .sort((a, b) => b.total.comparedTo(a.total))
      .map((row) => ({
        name: row.name,
        total: row.total.toFixed(2),
        percent: percentOf(row.total, categoryTotal),
      })),
    frequency,
    replacements,
    comparison: input.comparison.length > 1 ? input.comparison : [],
    insights,
  };
}
