import { LoanMethod } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { amortise, emiFor, type LoanTerms, monthsFor } from "./loan-schedule";

const D = (value: string | number) => new Prisma.Decimal(value);
const terms = (overrides: Partial<LoanTerms> = {}): LoanTerms => ({
  principal: D("800000"),
  annualRate: D("9"),
  tenureMonths: 60,
  firstEmiDate: "2025-05-05",
  method: LoanMethod.REDUCING,
  rateChanges: [],
  prepayments: [],
  ...overrides,
});
const sum = (rows: ReturnType<typeof amortise>, key: "principal" | "interest" | "prepayment") =>
  rows.reduce((total, row) => total.plus(row[key]), D(0));

describe("emiFor / monthsFor", () => {
  it("quotes the EMI to the rupee (₹8,00,000 at 9% for 5 years is ₹16,607)", () => {
    expect(emiFor(D("800000"), D("9").div(1200), 60).toFixed(2)).toBe("16607.00");
    expect(emiFor(D("120000"), D(0), 12).toFixed(2)).toBe("10000.00");
  });

  it("inverts the EMI, and says when an EMI can't cover the interest", () => {
    expect(monthsFor(D("800000"), D("9").div(1200), D("16607"))).toBe(60);
    expect(monthsFor(D("800000"), D("9").div(1200), D("6000"))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("amortise", () => {
  it("repays exactly the principal over the tenure, the last EMI taking the rounding", () => {
    const rows = amortise(terms());
    expect(rows).toHaveLength(60);
    expect(rows[0]).toMatchObject({ number: 1, date: "2025-05-05" });
    expect(rows[0]!.interest.toFixed(2)).toBe("6000.00"); // 8,00,000 × 0.75%
    expect(rows[0]!.principal.toFixed(2)).toBe("10607.00");
    expect(rows.at(-1)!.date).toBe("2030-04-05");
    expect(rows.at(-1)!.closingBalance.toFixed(2)).toBe("0.00");
    expect(sum(rows, "principal").toFixed(2)).toBe("800000.00");
    // Every EMI but the last is the quoted one.
    expect(rows.slice(0, -1).every((row) => row.emi.toFixed(2) === "16607.00")).toBe(true);
    expect(rows.at(-1)!.emi.minus(16607).abs().lessThan(50)).toBe(true);
  });

  it("keeps the EMI on a prepayment, so the loan ends sooner and costs less interest", () => {
    const base = amortise(terms());
    const rows = amortise(terms({ prepayments: [{ date: "2026-04-20", amount: D("100000") }] }));
    // It counts from the EMI after it: the 12th (5 Apr 2026) is the last one before it.
    expect(rows[11]).toMatchObject({ date: "2026-04-05" });
    expect(rows[11]!.prepayment.toFixed(2)).toBe("100000.00");
    expect(rows[12]!.emi.toFixed(2)).toBe("16607.00");
    expect(rows.length).toBeLessThan(base.length);
    expect(sum(rows, "principal").plus(sum(rows, "prepayment")).toFixed(2)).toBe("800000.00");
    expect(sum(rows, "interest").lessThan(sum(base, "interest"))).toBe(true);
  });

  it("applies a rate rise keeping the EMI (longer loan) or keeping the tenure (higher EMI)", () => {
    const rise = { effectiveFrom: "2026-01-01", annualRate: D("10") };
    const longer = amortise(terms({ rateChanges: [{ ...rise, keepEmi: true }] }));
    expect(longer.length).toBeGreaterThan(60);
    expect(longer[8]!.annualRate.toFixed(2)).toBe("10.00"); // 5 Jan 2026, the first EMI on or after it
    expect(longer[7]!.annualRate.toFixed(2)).toBe("9.00");
    expect(longer[8]!.emi.toFixed(2)).toBe("16607.00");

    const dearer = amortise(terms({ rateChanges: [{ ...rise, keepEmi: false }] }));
    expect(dearer).toHaveLength(60);
    expect(dearer[8]!.emi.greaterThan(16607)).toBe(true);
    for (const rows of [longer, dearer]) {
      expect(sum(rows, "principal").toFixed(2)).toBe("800000.00");
      expect(rows.at(-1)!.closingBalance.isZero()).toBe(true);
    }
  });

  it("keeps the tenure when a kept EMI would no longer cover the interest", () => {
    const rows = amortise(
      terms({ rateChanges: [{ effectiveFrom: "2025-06-01", annualRate: D("30"), keepEmi: true }] }),
    );
    expect(rows).toHaveLength(60);
    expect(rows[1]!.emi.greaterThan(16607)).toBe(true);
  });

  it("spreads flat interest evenly over the tenure", () => {
    const rows = amortise(
      terms({
        principal: D("500000"),
        annualRate: D("8"),
        tenureMonths: 36,
        method: LoanMethod.FLAT,
      }),
    );
    expect(rows).toHaveLength(36);
    // 5,00,000 × 8% × 3 years = 1,20,000 of interest; EMI (5,00,000 + 1,20,000) ÷ 36.
    expect(sum(rows, "interest").toFixed(2)).toBe("120000.00");
    expect(rows[0]!.interest.toFixed(2)).toBe("3333.33");
    expect(rows[0]!.emi.toFixed(2)).toBe("17222.00");
    expect(sum(rows, "principal").toFixed(2)).toBe("500000.00");
  });

  it("handles an interest-free loan", () => {
    const rows = amortise(terms({ principal: D("120000"), annualRate: D(0), tenureMonths: 12 }));
    expect(rows).toHaveLength(12);
    expect(sum(rows, "interest").isZero()).toBe(true);
    expect(rows.every((row) => row.emi.toFixed(2) === "10000.00")).toBe(true);
  });
});
