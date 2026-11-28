import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { depreciationBetween, depreciationPercent, monthsBetween } from "./depreciation";

const price = new Prisma.Decimal("1145000");

describe("depreciationPercent", () => {
  it("meets the IRDAI schedule at each step and spreads it in between", () => {
    expect(depreciationPercent(0).toNumber()).toBe(0);
    expect(depreciationPercent(3).toNumber()).toBe(2.5);
    expect(depreciationPercent(6).toNumber()).toBe(5);
    expect(depreciationPercent(9).toNumber()).toBe(10);
    expect(depreciationPercent(12).toNumber()).toBe(15);
    expect(depreciationPercent(24).toNumber()).toBe(20);
    expect(depreciationPercent(60).toNumber()).toBe(50);
  });

  it("holds after the 5-year schedule", () => {
    expect(depreciationPercent(90).toNumber()).toBe(50);
  });
});

describe("depreciationBetween", () => {
  it("is what the vehicle lost in the window, from the purchase date at the earliest", () => {
    // Bought 1 Jan 2025: the first year loses 15%.
    expect(depreciationBetween(price, "2025-01-01", "2000-01-01", "2026-01-01").toFixed(2)).toBe(
      "171750.00",
    );
    // A window before the purchase loses nothing.
    expect(depreciationBetween(price, "2025-01-01", "2024-01-01", "2024-12-31").toFixed(2)).toBe(
      "0.00",
    );
  });

  it("adds up across windows (no jumps at the steps)", () => {
    const first = depreciationBetween(price, "2025-01-01", "2025-01-01", "2025-07-02");
    const second = depreciationBetween(price, "2025-01-01", "2025-07-02", "2026-01-01");
    const whole = depreciationBetween(price, "2025-01-01", "2025-01-01", "2026-01-01");
    expect(first.plus(second).minus(whole).abs().lte("0.01")).toBe(true);
  });

  it("counts calendar months, the leftover days as a fraction", () => {
    expect(monthsBetween("2025-01-01", "2026-01-01")).toBe(12);
    expect(monthsBetween("2025-01-15", "2025-03-15")).toBe(2);
    expect(monthsBetween("2025-01-01", "2025-01-16")).toBeCloseTo(0.49, 2);
  });
});
