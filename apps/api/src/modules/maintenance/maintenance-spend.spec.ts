import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { monthsIn, summarizeSpend } from "./maintenance-spend";

const row = (month: string, categoryKey: string, total: string) => ({
  month,
  categoryKey,
  total: new Prisma.Decimal(total),
});

describe("monthsIn", () => {
  it("lists every month the window touches, across a year end", () => {
    expect(monthsIn({ from: "2025-11-28", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("summarizeSpend", () => {
  it("splits maintenance and repairs exactly, fills empty months and nets refunds", () => {
    const spend = summarizeSpend(
      [
        row("2026-09", "MAINTENANCE", "6850.10"),
        row("2026-09", "REPAIRS", "1200.20"),
        // A month whose refund exceeded its spend nets below zero; totals still add up.
        row("2026-11", "MAINTENANCE", "-150.30"),
      ],
      [row("2026-05", "MAINTENANCE", "999.99"), row("2026-06", "REPAIRS", "0.01")],
      { from: "2026-09-01", to: "2026-11-27" },
    );
    expect(spend).toEqual({
      total: "7900.00",
      maintenance: "6699.80",
      repairs: "1200.20",
      previousTotal: "1000.00",
      months: [
        { month: "2026-09", maintenance: "6850.10", repairs: "1200.20" },
        { month: "2026-10", maintenance: "0.00", repairs: "0.00" },
        { month: "2026-11", maintenance: "-150.30", repairs: "0.00" },
      ],
    });
  });
});
