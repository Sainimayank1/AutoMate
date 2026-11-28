import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { budgetProgress, budgetWindow } from "./budget-progress";

const D = (value: string) => new Prisma.Decimal(value);
const progress = (spent: string, alert = 80) => {
  const result = budgetProgress(D("8000"), D(spent), alert);
  return { ...result, remaining: result.remaining.toFixed(2) };
};

describe("budgetWindow", () => {
  it("is the IST month or year today falls in", () => {
    expect(budgetWindow("MONTH", "2026-11-27")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(budgetWindow("MONTH", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(budgetWindow("YEAR", "2026-11-27")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("budgetProgress", () => {
  it("is on track below the alert threshold", () => {
    expect(progress("6399.99")).toEqual({ remaining: "1600.01", percent: 79, state: "ON_TRACK" });
  });

  it("warns from the threshold, up to and at the limit", () => {
    expect(progress("6400")).toMatchObject({ percent: 80, state: "WARNING" });
    expect(progress("8000")).toEqual({ remaining: "0.00", percent: 100, state: "WARNING" });
  });

  it("is over past the limit, with what it's over by", () => {
    expect(progress("8000.01")).toEqual({ remaining: "-0.01", percent: 100, state: "OVER" });
    expect(progress("12000")).toMatchObject({ remaining: "-4000.00", percent: 150 });
  });

  it("treats refunds that outweigh spending as nothing spent", () => {
    expect(progress("-500")).toEqual({ remaining: "8500.00", percent: 0, state: "ON_TRACK" });
  });

  it("warns only at 100% when the alert is set there", () => {
    expect(progress("7990", 100)).toMatchObject({ percent: 99, state: "ON_TRACK" });
  });
});
