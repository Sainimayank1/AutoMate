import {
  type ExpenseCategoryRef,
  FuelType,
  type PeriodWindow,
  ReportingPeriod,
} from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { buildInsights, type InsightInputs } from "./insights";
import type { WindowFigures } from "./metrics";
import type { CategoryRow } from "./spending";

const D = (value: string) => new Prisma.Decimal(value);
const VEHICLE = "11111111-1111-4111-8111-111111111111";
const PERIOD: PeriodWindow = {
  period: ReportingPeriod.THIS_MONTH,
  from: "2026-11-01",
  to: "2026-11-27",
  previous: { from: "2026-10-01", to: "2026-10-27" },
  endsToday: true,
};

type Fig = {
  records?: number;
  spent?: string;
  distanceKm?: number | null;
  readings?: number;
  mileage?: string | null;
  cycles?: number;
  costPerKm?: string | null;
  quantity?: string;
  spend?: string;
  trend?: [string, string][];
};
const figures = (f: Fig): WindowFigures => ({
  totals: { records: f.records ?? 0, spent: D(f.spent ?? "0"), operating: D("0"), fuel: D("0") },
  usage: { readings: f.readings ?? 2, distanceKm: f.distanceKm ?? null, costPerKm: null },
  fuel: {
    fuelType: FuelType.PETROL,
    mileage: f.mileage ? D(f.mileage) : null,
    cycles: f.cycles ?? 0,
    quantity: D(f.quantity ?? "0"),
    spend: D(f.spend ?? "0"),
    costPerKm: f.costPerKm ? D(f.costPerKm) : null,
    latest: null,
    trend: (f.trend ?? []).map(([date, mileage]) => ({ date, mileage })),
  },
});
const category = (id: string, name: string, key: string | null): ExpenseCategoryRef => ({
  id,
  key,
  name,
  icon: "receipt",
  costClass: "OPERATING",
});
const FUEL = category("c-fuel", "Fuel", "FUEL");
const SERVICE = category("c-service", "Maintenance & servicing", "MAINTENANCE");
const row = (cat: ExpenseCategoryRef, total: string, month: string | null = null): CategoryRow => ({
  month,
  category: cat,
  total: D(total),
});
const inputs = (now: Fig, before: Fig, spending: InsightInputs["spending"] = null) => ({
  vehicleId: VEHICLE,
  window: PERIOD,
  figures: { now: figures(now), before: figures(before), since: "2026-01-04" },
  spending,
});
const ids = (result: ReturnType<typeof buildInsights>) => result.items.map((item) => item.id);

describe("buildInsights", () => {
  it("says what's missing for a vehicle with no records", () => {
    expect(
      buildInsights({ vehicleId: VEHICLE, window: PERIOD, figures: null, spending: null }),
    ).toEqual({
      items: [],
      needs: ["expenses", "fuel_cycles", "odometer"],
    });
  });

  it("explains a rise in spending with the category that moved most", () => {
    const spending = {
      inPeriod: [row(FUEL, "6718.21"), row(SERVICE, "2650")],
      previous: [row(FUEL, "3200"), row(SERVICE, "3000")],
      monthly: [],
      months: [],
    };
    const [item] = buildInsights(
      inputs({ records: 6, spent: "9368.21" }, { records: 4, spent: "6200" }, spending),
    ).items;
    expect(item).toMatchObject({
      id: "spending_change",
      tone: "negative",
      title: "Spending is up 51%",
      explanation: "₹9,368.21 so far against ₹6,200.00. Fuel rose the most: +₹3,518.21.",
      metric: { label: "Spent", value: "₹9,368.21", previous: "₹6,200.00" },
      comparedWith: PERIOD.previous,
      confidence: null,
    });
    expect(item!.action.href).toBe(
      `/expenses/transactions?vehicle=${VEHICLE}&from=2026-11-01&to=2026-11-27`,
    );
  });

  it("ignores small changes and needs records in both windows", () => {
    // 8% is too small a share; +200% is only ₹200
    expect(
      ids(buildInsights(inputs({ records: 3, spent: "10800" }, { records: 3, spent: "10000" }))),
    ).toEqual([]);
    expect(
      ids(buildInsights(inputs({ records: 3, spent: "300" }, { records: 3, spent: "100" }))),
    ).toEqual([]);
    const result = buildInsights(inputs({ records: 3, spent: "5000" }, {}));
    expect(result.items).toEqual([]);
    expect(result.needs).toEqual(["expenses", "fuel_cycles", "odometer"]);
    // Records start inside the earlier window: it isn't all on record, so no comparison.
    const partial = inputs({ records: 9, spent: "20000" }, { records: 1, spent: "4000" });
    expect(
      buildInsights({ ...partial, figures: { ...partial.figures, since: "2026-10-05" } }).needs,
    ).toContain("expenses");
  });

  it("reports fuel cost per km over cycles, with mileage and price behind it", () => {
    const now = { cycles: 3, mileage: "15.2", costPerKm: "6.95", quantity: "60", spend: "6600" };
    const before = { cycles: 2, mileage: "17.0", costPerKm: "6.00", quantity: "60", spend: "6120" };
    const [item] = buildInsights(inputs(now, before)).items;
    expect(item).toMatchObject({
      id: "fuel_cost_per_km",
      topic: "fuel",
      tone: "negative",
      title: "Fuel costs 16% more per km",
      comparedWith: PERIOD.previous,
      explanation:
        "₹6.95 a km against ₹6.00, over full-tank cycles. Mileage 15.2 against 17.0 km/L; you paid ₹110.00 against ₹102.00 per L.",
      confidence: "medium",
    });
  });

  it("keeps one fuel insight: the worse news first", () => {
    const now = { cycles: 1, mileage: "18.0", costPerKm: "5.80" };
    const before = { cycles: 1, mileage: "16.0", costPerKm: "5.90" };
    const result = buildInsights(inputs(now, before));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "mileage_change",
      tone: "positive",
      title: "Mileage improved 13%",
      explanation: "18.0 km/L over 1 full-tank cycle against 16.0 km/L over 1 full-tank cycle.",
      confidence: "low",
    });
    expect(result.needs).not.toContain("fuel_cycles");
  });

  it("spots mileage falling over the latest full tanks in the period", () => {
    const trend: [string, string][] = [
      ["2026-09-25T06:00:00.000Z", "16.40"],
      ["2026-10-12T06:00:00.000Z", "17.30"],
      ["2026-10-30T06:00:00.000Z", "16.80"],
      ["2026-11-24T06:00:00.000Z", "16.10"],
    ];
    const [item] = buildInsights(inputs({ trend }, {})).items;
    expect(item).toMatchObject({
      id: "mileage_falling",
      title: "Mileage fell over the last 3 full tanks",
      explanation: "17.3, 16.8 then 16.1 km/L: 7% lower.",
      comparedWith: null,
    });
    // the latest full tank before the period: old news
    const old = trend.map(([date, mileage]): [string, string] => [
      date.replace("2026-11-24", "2026-10-31"),
      mileage,
    ]);
    expect(ids(buildInsights(inputs({ trend: old }, {})))).toEqual([]);
  });

  it("reports a big change in distance as neutral", () => {
    const [item] = buildInsights(
      inputs({ distanceKm: 640, readings: 4 }, { distanceKm: 780, readings: 5 }),
    ).items;
    expect(item).toMatchObject({
      id: "distance_change",
      tone: "neutral",
      title: "You drove 18% less",
      explanation: "640 km so far against 780 km, from odometer readings.",
      confidence: "high",
      action: { href: `/garage/${VEHICLE}` },
    });
    expect(ids(buildInsights(inputs({ distanceKm: 150 }, { distanceKm: 100 })))).toEqual([]);
    // Readings that start inside the earlier window don't cover it.
    const partial = inputs({ distanceKm: 640 }, { distanceKm: 300 });
    expect(
      buildInsights({ ...partial, figures: { ...partial.figures, since: "2026-10-20" } }).needs,
    ).toContain("odometer");
  });

  it("spots maintenance costs rising month after month", () => {
    const spending = {
      inPeriod: [],
      previous: [],
      monthly: [
        row(SERVICE, "800", "2026-09"),
        row(SERVICE, "1500", "2026-10"),
        row(SERVICE, "2650", "2026-11"),
        row(FUEL, "9000", "2026-09"),
      ],
      months: ["2026-08", "2026-09", "2026-10", "2026-11"],
    };
    const [item] = buildInsights(inputs({}, {}, spending)).items;
    expect(item).toMatchObject({
      id: "maintenance_rising",
      title: "Maintenance costs rose 3 months running",
      explanation: "₹800.00 in Sep, ₹1,500.00 in Oct and ₹2,650.00 in Nov so far.",
    });
    spending.monthly[1] = row(SERVICE, "800", "2026-10");
    expect(ids(buildInsights(inputs({}, {}, spending)))).toEqual([]);
  });

  it("ranks costs first, then improvements, then the rest", () => {
    const result = buildInsights(
      inputs(
        {
          records: 5,
          spent: "5000",
          distanceKm: 1200,
          cycles: 2,
          mileage: "18.0",
          costPerKm: "5.5",
        },
        {
          records: 5,
          spent: "8000",
          distanceKm: 600,
          cycles: 2,
          mileage: "17.0",
          costPerKm: "6.0",
        },
        {
          inPeriod: [],
          previous: [],
          monthly: [
            row(SERVICE, "100", "2026-09"),
            row(SERVICE, "200", "2026-10"),
            row(SERVICE, "300", "2026-11"),
          ],
          months: ["2026-09", "2026-10", "2026-11"],
        },
      ),
    );
    expect(ids(result)).toEqual([
      "maintenance_rising",
      "spending_change",
      "mileage_change",
      "distance_change",
    ]);
    expect(result.needs).toEqual([]);
  });
});
