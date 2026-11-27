import { FuelType } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { buildMetrics, compare, type WindowFigures } from "./metrics";

const D = (value: string) => new Prisma.Decimal(value);
const window = (overrides: {
  records?: number;
  spent?: string;
  operating?: string;
  fuel?: string;
  distanceKm?: number | null;
  costPerKm?: string | null;
  mileage?: string | null;
  cycles?: number;
  quantity?: string;
  fuelType?: FuelType;
}): WindowFigures => ({
  totals: {
    records: overrides.records ?? 0,
    spent: D(overrides.spent ?? "0"),
    operating: D(overrides.operating ?? "0"),
    fuel: D(overrides.fuel ?? "0"),
  },
  usage: {
    readings: 2,
    distanceKm: overrides.distanceKm ?? null,
    costPerKm: overrides.costPerKm ? D(overrides.costPerKm) : null,
  },
  fuel: {
    fuelType: overrides.fuelType ?? FuelType.PETROL,
    mileage: overrides.mileage ? D(overrides.mileage) : null,
    cycles: overrides.cycles ?? 0,
    quantity: D(overrides.quantity ?? "0"),
    spend: D("0"),
    costPerKm: null,
    latest: null,
    trend: [],
  },
});

describe("compare", () => {
  it("never shows a percentage against nothing or zero", () => {
    expect(compare(D("11840"), D("12590"), 2)).toEqual({
      value: "11840.00",
      previous: "12590.00",
      change: "-750.00",
      changePercent: -6,
    });
    expect(compare(D("500"), D("0"), 2).changePercent).toBeNull();
    expect(compare(D("500"), null, 2)).toMatchObject({ previous: null, change: null });
    expect(compare(null, D("4"), 2)).toMatchObject({ value: null, change: null });
  });
});

describe("buildMetrics", () => {
  it("compares like for like and keeps each figure in its unit", () => {
    const metrics = buildMetrics(
      window({
        records: 9,
        spent: "11840",
        fuel: "7120",
        distanceKm: 1140,
        costPerKm: "10.38",
        mileage: "16.8",
        cycles: 2,
        quantity: "68.25",
      }),
      window({
        records: 7,
        spent: "12590",
        fuel: "6593",
        distanceKm: 1018,
        costPerKm: "10.80",
        mileage: "16.2",
        cycles: 2,
        quantity: "63",
      }),
    );
    expect(metrics.spent).toMatchObject({ value: "11840.00", changePercent: -6, records: 9 });
    expect(metrics.runningCostPerKm).toMatchObject({ value: "10.38", change: "-0.42" });
    expect(metrics.mileage).toMatchObject({
      value: "16.80",
      change: "0.60",
      unit: "km/L",
      cycles: 2,
    });
    expect(metrics.distance).toMatchObject({ value: "1140", changePercent: 12 });
    expect(metrics.fuelSpend).toMatchObject({ changePercent: 8, quantity: "68.25", unit: "L" });
  });

  it("has nothing to compare with when the earlier window had no records", () => {
    const metrics = buildMetrics(
      window({ records: 3, spent: "3380", fuel: "3380", quantity: "32.4", fuelType: FuelType.CNG }),
      window({}),
    );
    expect(metrics.spent).toMatchObject({ value: "3380.00", previous: null, changePercent: null });
    expect(metrics.fuelSpend).toMatchObject({ previous: null, unit: "kg" });
    expect(metrics.mileage).toMatchObject({ value: null, unit: "km/kg" });
    expect(metrics.distance.value).toBeNull();
  });
});
