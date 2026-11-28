import type { Budget, ExpenseCategoryRef } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import {
  aboveUsual,
  budgetInsights,
  duplicateInsights,
  largeInsights,
  type MonthRow,
} from "./expense-insights";

const D = (value: string) => new Prisma.Decimal(value);
const V = "veh";
const category = (id: string, name: string): ExpenseCategoryRef => ({
  id,
  key: null,
  name,
  icon: "route",
  costClass: "OPERATING",
});
const daily = category("c-daily", "Daily usage");
const insurance = category("c-ins", "Insurance & legal");
const row = (month: string, cat: ExpenseCategoryRef, total: string): MonthRow => ({
  month,
  category: cat,
  total: D(total),
});

describe("budgetInsights", () => {
  const budget = (id: string, state: Budget["state"], percent: number, extra = {}): Budget => ({
    id,
    vehicleId: V,
    category: null,
    period: "MONTH",
    amount: "1200.00",
    alertPercent: 80,
    window: { from: "2026-11-01", to: "2026-11-30" },
    spent: "1350.00",
    remaining: "-150.00",
    percent,
    state,
    createdAt: "",
    updatedAt: "",
    ...extra,
  });

  it("lists over-budget ones first, then those near the limit; on track stays quiet", () => {
    const items = budgetInsights(
      [
        budget("near", "WARNING", 84, {
          category: daily,
          spent: "1008.00",
          remaining: "192.00",
        }),
        budget("ok", "ON_TRACK", 40),
        budget("over", "OVER", 112),
      ],
      V,
    );
    expect(items.map((item) => item.id)).toEqual(["budget:over", "budget:near"]);
    expect(items[0]).toMatchObject({
      title: "Your overall budget is over budget",
      explanation: "₹1,350.00 spent this month against a limit of ₹1,200.00: over by ₹150.00.",
      action: { href: "/expenses/budgets?vehicle=veh" },
    });
    expect(items[1]!.title).toBe("Daily usage is near its limit");
  });
});

describe("aboveUsual", () => {
  it("flags a category well above its average month, over the months with records", () => {
    const { items, monthsOfHistory } = aboveUsual(
      [
        row("2026-08", daily, "400"),
        row("2026-09", daily, "500"),
        row("2026-10", daily, "600"),
        row("2026-11", daily, "1350"),
        row("2026-08", insurance, "15400"),
      ],
      "2026-11-28",
      V,
    );
    expect(monthsOfHistory).toBe(3);
    // Daily usage usually ₹500 a month; insurance was usual for nobody this month.
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "above:c-daily:2026-11",
      title: "Daily usage is above its usual",
      explanation: "₹1,350.00 so far this month against ₹500.00 a month on average over Aug–Oct.",
      action: {
        href: "/expenses/transactions?vehicle=veh&category=c-daily&from=2026-11-01&to=2026-11-28",
      },
    });
  });

  it("stays quiet below the thresholds, for categories usually at zero, and without history", () => {
    const history = [row("2026-09", daily, "500"), row("2026-10", daily, "500")];
    // 20% above: under the 25% bar.
    expect(aboveUsual([...history, row("2026-11", daily, "600")], "2026-11-28", V).items).toEqual(
      [],
    );
    // A first premium isn't "above its usual".
    expect(
      aboveUsual([...history, row("2026-11", insurance, "15400")], "2026-11-28", V).items,
    ).toEqual([]);
    expect(
      aboveUsual([row("2026-10", daily, "500"), row("2026-11", daily, "5000")], "2026-11-28", V),
    ).toEqual({ items: [], monthsOfHistory: 1 });
  });
});

describe("duplicateInsights", () => {
  it("points at the second entry", () => {
    const [pair] = duplicateInsights([
      {
        id: "a",
        otherId: "b",
        title: "NH-48 FASTag",
        category: "Daily usage",
        amount: D("640"),
        date: "2026-11-21",
      },
    ]);
    expect(pair).toMatchObject({
      title: "Possible duplicate: NH-48 FASTag",
      explanation:
        "Two ₹640.00 Daily usage expenses on 21 Nov 2026. If one was entered twice, delete it.",
      action: { href: "/expenses/transactions/b" },
    });
  });
});

describe("largeInsights", () => {
  it("flags expenses three times the typical one and at least ₹2,000, biggest first", () => {
    const items = largeInsights(
      [
        { id: "small", title: "Wash", amount: D("1500"), date: "2026-11-10" },
        { id: "tyres", title: "Four tyres", amount: D("24000"), date: "2026-11-12" },
        { id: "wiper", title: "Wipers", amount: D("2100"), date: "2026-11-14" },
      ],
      D("640"),
    );
    expect(items.map((item) => item.id)).toEqual(["large:tyres", "large:wiper"]);
    expect(items[0]!.explanation).toBe(
      "₹24,000.00 on 12 Nov 2026, about 37× your typical expense of ₹640.00.",
    );
  });

  it("needs a typical expense to compare with", () => {
    expect(
      largeInsights([{ id: "x", title: "X", amount: D("9000"), date: "2026-11-01" }], null),
    ).toEqual([]);
  });
});
