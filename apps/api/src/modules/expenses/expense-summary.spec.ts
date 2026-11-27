import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import {
  type MonthTotal,
  overviewPeriods,
  summarizeExpenses,
  type YearReadings,
} from "./expense-summary";

const NOW = new Date("2026-11-27T06:00:00.000Z"); // 27 Nov 2026, 11:30 IST
const A = "vehicle-a";
const B = "vehicle-b";
const D = (value: string) => new Prisma.Decimal(value);

const row = (
  month: string,
  costClass: MonthTotal["costClass"],
  total: string,
  overrides: Partial<MonthTotal> = {},
): MonthTotal => ({
  month,
  vehicleId: A,
  categoryId: `cat-${costClass}`,
  costClass,
  kind: "EXPENSE",
  total: new Prisma.Decimal(total),
  ...overrides,
});

describe("overviewPeriods", () => {
  it("uses the IST calendar, including the January → December step back", () => {
    expect(overviewPeriods(NOW)).toMatchObject({
      month: "2026-11",
      lastMonth: "2026-10",
      lastMonthWindow: { from: "2026-10-01", to: "2026-10-27" }, // the same days, not all October
      from: "2026-01-01",
    });
    // 31 Dec 2026, 23:30 UTC is already 1 Jan 2027 in India.
    expect(overviewPeriods(new Date("2026-12-31T23:30:00.000Z"))).toMatchObject({
      today: "2027-01-01",
      month: "2027-01",
      lastMonth: "2026-12",
      lastMonthWindow: { from: "2026-12-01", to: "2026-12-01" },
      from: "2026-12-01",
    });
  });
});

describe("summarizeExpenses", () => {
  it("separates operating cost from loan and other cash, net of refunds", () => {
    const summary = summarizeExpenses(
      [
        row("2026-11", "OPERATING", "5000", { categoryId: "fuel" }),
        row("2026-11", "OPERATING", "1500", { categoryId: "daily" }),
        row("2026-11", "OPERATING", "200", { categoryId: "daily", kind: "REFUND" }),
        row("2026-11", "FINANCING", "16684"),
        row("2026-11", "OWNERSHIP", "38500"),
        row("2026-10", "OPERATING", "4000", { categoryId: "fuel" }),
        row("2026-08", "OPERATING", "1000", { categoryId: "fuel" }),
        row("2025-12", "OPERATING", "9999", { categoryId: "fuel" }), // last year: not in "this year"
      ],
      [],
      NOW,
      D("4000"), // 1–27 Oct
    );
    expect(summary.operating).toEqual({
      thisMonth: "6300.00",
      lastMonth: "4000.00",
      lastMonthWindow: { from: "2026-10-01", to: "2026-10-27" },
      changePercent: 58, // 6300 / 4000 − 1 = 57.5 %
      thisYear: "11300.00",
      monthsCovered: 4, // August to November
      monthlyAverage: "2825.00",
    });
    expect(summary.loanOutflowThisMonth).toBe("16684.00");
    expect(summary.cashOutflowThisMonth).toBe("61484.00"); // 6,300 + 16,684 + 38,500
    expect(summary.categories.map((item) => [item.categoryId, item.amount.toFixed(2)])).toEqual([
      ["fuel", "5000.00"],
      ["daily", "1300.00"],
    ]);
  });

  it("prices running cost per km only over km it knows", () => {
    const readings: YearReadings[] = [
      {
        vehicleId: A,
        readings: 3,
        minInYear: 5600,
        maxInYear: 8412,
        before: 5000,
        costAfterFirst: D("1"),
      }, // 3,412 km
      {
        vehicleId: B,
        readings: 1,
        minInYear: 42180,
        maxInYear: 42180,
        before: null,
        costAfterFirst: D("9000"),
      }, // unknown
    ];
    const summary = summarizeExpenses(
      [
        row("2026-11", "OPERATING", "17060", { vehicleId: A }),
        row("2026-11", "OPERATING", "9000", { vehicleId: B }),
      ],
      readings,
      NOW,
      D("0"),
    );
    expect(summary.distanceKm).toBe(3412);
    expect(summary.costPerKm).toBe("5.00"); // B's cost has no km: left out
  });

  it("starts at the first reading this year when there's none before it", () => {
    // Fill-ups at 5,600 km (₹3,129.60) and 8,412 km: the first one's fuel isn't in those 2,812 km.
    const summary = summarizeExpenses(
      [row("2026-08", "OPERATING", "3129.60"), row("2026-11", "OPERATING", "14718.08")],
      [
        {
          vehicleId: A,
          readings: 2,
          minInYear: 5600,
          maxInYear: 8412,
          before: null,
          costAfterFirst: D("14718.08"),
        },
      ],
      NOW,
      D("0"),
    );
    expect(summary.distanceKm).toBe(2812);
    expect(summary.costPerKm).toBe("5.23"); // 14,718.08 / 2,812, not 17,847.68 / 2,812
  });

  it("reports nothing it can't support", () => {
    const summary = summarizeExpenses(
      [],
      [
        {
          vehicleId: A,
          readings: 1,
          minInYear: 8000,
          maxInYear: 8000,
          before: null,
          costAfterFirst: D("0"),
        },
      ],
      NOW,
      D("0"),
    );
    expect(summary).toMatchObject({
      operating: { thisMonth: "0.00", changePercent: null, monthsCovered: 0, monthlyAverage: null },
      costPerKm: null,
      distanceKm: null,
      categories: [],
    });
  });
});
