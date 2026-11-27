import { type ExpenseCategoryRef, FuelType } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { drivingOverview, fuelOverview, spendingOverview, trendMonths } from "./spending";

const D = (value: string) => new Prisma.Decimal(value);
const category = (key: string | null, name: string): ExpenseCategoryRef => ({
  id: `id-${name}`,
  key,
  name,
  icon: "route",
  costClass: "OPERATING",
});
const FUEL = category("FUEL", "Fuel");
const SERVICE = category("MAINTENANCE", "Maintenance & servicing");
const REPAIRS = category("REPAIRS", "Repairs");
const DAILY = category("DAILY_USAGE", "Daily usage");
const MINE = category(null, "Driver salary");

describe("trendMonths", () => {
  it("shows 6 months ending with the period's last, more for longer periods (up to 12)", () => {
    expect(trendMonths({ from: "2026-11-01", to: "2026-11-27" })).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(trendMonths({ from: "2026-01-01", to: "2026-11-27" })).toHaveLength(11);
    expect(trendMonths({ from: "2024-01-01", to: "2026-11-27" })).toHaveLength(12);
    expect(trendMonths({ from: "2026-12-01", to: "2027-01-05" })[5]).toBe("2027-01");
  });
});

describe("spendingOverview", () => {
  it("ranks the period's categories and groups each month into the five chart series", () => {
    const overview = spendingOverview(
      [
        { month: null, category: FUEL, total: D("7120") },
        { month: null, category: SERVICE, total: D("2650") },
        { month: null, category: DAILY, total: D("1220") },
        { month: null, category: MINE, total: D("-150") }, // refunded more than spent this period
      ],
      [
        { month: "2026-11", category: FUEL, total: D("7120") },
        { month: "2026-11", category: SERVICE, total: D("2650") },
        { month: "2026-11", category: REPAIRS, total: D("1000") },
        { month: "2026-11", category: MINE, total: D("500") },
        { month: "2026-10", category: FUEL, total: D("6593") },
      ],
      ["2026-10", "2026-11"],
    );
    expect(overview.total).toBe("10840.00"); // net: 7,120 + 2,650 + 1,220 − 150
    expect(
      overview.categories.map((item) => [item.category.name, item.amount, item.percent]),
    ).toEqual([
      ["Fuel", "7120.00", 64.8], // of the 10,990 actually spent
      ["Maintenance & servicing", "2650.00", 24.1],
      ["Daily usage", "1220.00", 11.1],
    ]);
    expect(overview.months).toEqual([
      {
        month: "2026-10",
        total: "6593.00",
        groups: {
          fuel: "6593.00",
          maintenance: "0.00",
          insurance: "0.00",
          loan: "0.00",
          other: "0.00",
        },
      },
      {
        month: "2026-11",
        total: "11270.00",
        // Maintenance and repairs share a series; custom categories are "other".
        groups: {
          fuel: "7120.00",
          maintenance: "3650.00",
          insurance: "0.00",
          loan: "0.00",
          other: "500.00",
        },
      },
    ]);
  });
});

describe("fuelOverview", () => {
  it("prices fuel over the period's fill-ups and keeps the fuel's unit", () => {
    const overview = fuelOverview(
      {
        fuelType: FuelType.CNG,
        mileage: D("24.5"),
        cycles: 3,
        quantity: D("20"),
        spend: D("1680"),
        costPerKm: D("3.43"),
        latest: { date: "2026-11-24T08:30:00.000Z", mileage: "25.10" },
        trend: [],
      },
      D("1600"),
    );
    expect(overview).toMatchObject({
      unit: "kg",
      mileageUnit: "km/kg",
      averageMileage: "24.50",
      averagePrice: "84.00",
      spend: "1600.00", // net of a refund, as in Expenses
      costPerKm: "3.43",
    });
  });
});

describe("drivingOverview", () => {
  const november = { from: "2026-11-01", to: "2026-11-30" };
  it("averages km a day over the period so far, never into the future", () => {
    expect(
      drivingOverview(
        { readings: 3, distanceKm: 1092 },
        { km: 8412, date: "2026-11-24" },
        november,
        "2026-11-27",
      ),
    ).toEqual({
      distanceKm: 1092,
      readings: 3,
      perDay: "40.4", // 1,092 km over 27 days
      lastReading: { km: 8412, date: "2026-11-24" },
    });
  });

  it("has no distance from one reading, and nothing at all without readings", () => {
    expect(
      drivingOverview(
        { readings: 1, distanceKm: null },
        { km: 8412, date: "2026-11-24" },
        november,
        "2026-11-27",
      ),
    ).toMatchObject({ distanceKm: null, perDay: null });
    expect(
      drivingOverview({ readings: 0, distanceKm: null }, null, november, "2026-11-27"),
    ).toBeNull();
  });
});
