import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { type AnalyticsInput, buildAnalytics, serviceFrequency } from "./maintenance-analytics";

const d = (value: string) => new Prisma.Decimal(value);
const window = { from: "2026-01-01", to: "2026-06-30" };
const base: AnalyticsInput = {
  window,
  current: [
    { month: "2026-02", categoryKey: "MAINTENANCE", total: d("6000") },
    { month: "2026-05", categoryKey: "MAINTENANCE", total: d("4000") },
    { month: "2026-05", categoryKey: "REPAIRS", total: d("2500.50") },
  ],
  previous: [
    { month: "2025-09", categoryKey: "MAINTENANCE", total: d("9000") },
    { month: "2025-10", categoryKey: "REPAIRS", total: d("1000") },
  ],
  categories: [
    { name: "Engine oil", total: d("4000") },
    { name: "General servicing", total: d("6000") },
    { name: "AC repair", total: d("2500.50") },
  ],
  records: [
    { date: "2026-02-10", odometerKm: 10_000, type: "ROUTINE_SERVICE" },
    { date: "2026-05-11", odometerKm: 13_400, type: "ROUTINE_SERVICE" },
    { date: "2026-05-11", odometerKm: 13_400, type: "REPAIR" },
  ],
  replacements: [
    {
      name: "Front brake pads",
      replacedOn: "2026-05-11",
      replacedKm: 13_400,
      installedKm: 0,
      expectedLifeKm: 20_000,
    },
  ],
  distanceKm: 5_000,
  comparison: [],
};

describe("buildAnalytics", () => {
  it("totals spend from Expenses, splits repairs and works out the per-service and per-km cost", () => {
    const result = buildAnalytics(base);
    expect(result.totals).toEqual({
      spend: "12500.50",
      maintenance: "10000.00",
      repairs: "2500.50",
      services: 3,
      repairVisits: 1,
      averagePerService: "4166.83",
      distanceKm: 5_000,
      costPerKm: "2.50",
    });
    expect(result.months).toHaveLength(6);
    expect(result.months[4]).toEqual({
      month: "2026-05",
      maintenance: "4000.00",
      repairs: "2500.50",
    });
  });

  it("ranks categories with their share, and the life a replaced part reached", () => {
    const result = buildAnalytics(base);
    expect(result.categories).toEqual([
      { name: "General servicing", total: "6000.00", percent: 48 },
      { name: "Engine oil", total: "4000.00", percent: 32 },
      { name: "AC repair", total: "2500.50", percent: 20 },
    ]);
    expect(result.replacements[0]).toMatchObject({ lifeKm: 13_400, percentOfLife: 67 });
  });

  it("says only what the figures show", () => {
    expect(buildAnalytics(base).insights).toEqual([
      "Repairs were 20% of maintenance spend, up from 10% in the period before.",
      "Maintenance spend is 25% higher than the period before (₹12,500.50 against ₹10,000.00).",
      "Front brake pads was replaced at 67% of its estimated life (13,400 km of 20,000 km).",
      "On average, 90 days and 3,400 km passed between services.",
    ]);
    const empty = buildAnalytics({
      ...base,
      current: [],
      previous: [],
      categories: [],
      records: [],
      replacements: [],
      distanceKm: null,
    });
    expect(empty.insights).toEqual([]);
    expect(empty.totals).toMatchObject({ spend: "0.00", averagePerService: null, costPerKm: null });
  });

  it("compares vehicles only when there's more than one", () => {
    const one = {
      vehicleId: "v1",
      name: "Victoris",
      registrationNumber: "HR26EV4821",
      spend: "100.00",
      services: 1,
      costPerKm: null,
    };
    expect(buildAnalytics({ ...base, comparison: [one] }).comparison).toEqual([]);
    expect(
      buildAnalytics({ ...base, comparison: [one, { ...one, vehicleId: "v2" }] }).comparison,
    ).toHaveLength(2);
  });
});

describe("serviceFrequency", () => {
  it("averages the gaps between visits, one visit per day, skipping unknown readings for km", () => {
    expect(
      serviceFrequency([
        { date: "2026-03-01", odometerKm: null, type: "ROUTINE_SERVICE" },
        { date: "2026-01-01", odometerKm: 8_000, type: "ROUTINE_SERVICE" },
        { date: "2026-01-01", odometerKm: 8_050, type: "REPAIR" },
        { date: "2026-05-30", odometerKm: 14_050, type: "ROUTINE_SERVICE" },
      ]),
    ).toEqual({ averageDays: 75, averageKm: null, intervals: 2 });
    expect(serviceFrequency([])).toEqual({ averageDays: null, averageKm: null, intervals: 0 });
  });
});
