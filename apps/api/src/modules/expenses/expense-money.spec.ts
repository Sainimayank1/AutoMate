import {
  createExpenseSchema,
  FINANCE_COMPONENT_BY_KEY,
  fromPaise,
  splitEqually,
  SYSTEM_EXPENSE_CATEGORIES,
  toPaise,
} from "@automate/shared";
import { describe, expect, it } from "vitest";

describe("expense money (shared)", () => {
  it("converts rupees and paise exactly", () => {
    expect(toPaise("1499.5")).toBe(149950);
    expect(toPaise("0.05")).toBe(5);
    expect(toPaise("9999999999.99")).toBe(999999999999);
    expect(fromPaise(149950)).toBe("1499.50");
    expect(fromPaise(5)).toBe("0.05");
  });

  it("splits shared amounts so the shares always add up", () => {
    expect(splitEqually("1000", 3)).toEqual(["333.34", "333.33", "333.33"]);
    expect(splitEqually("0.05", 2)).toEqual(["0.03", "0.02"]);
    for (const [amount, parts] of [
      ["1234.57", 7],
      ["10", 3],
      ["0.01", 2],
    ] as const) {
      const shares = splitEqually(amount, parts);
      expect(shares.reduce((sum, share) => sum + toPaise(share), 0)).toBe(toPaise(amount));
    }
  });

  it("checks a loan payment's split and a custom share split", () => {
    const base = {
      allocation: { mode: "single", vehicleId: "0190d4a2-0000-7000-8000-00000000a001" },
      categoryId: "0190d4a2-0000-7000-8000-00000000c001",
      title: "EMI",
      amount: "16684",
      date: "2026-11-05",
    };
    expect(
      createExpenseSchema.safeParse({ ...base, principalAmount: "10950", interestAmount: "5734" })
        .success,
    ).toBe(true);
    expect(
      createExpenseSchema.safeParse({ ...base, principalAmount: "10950", interestAmount: "5733" })
        .success,
    ).toBe(false);
    expect(
      createExpenseSchema
        .safeParse({
          ...base,
          allocation: {
            mode: "shared",
            split: "custom",
            vehicles: [
              { vehicleId: "0190d4a2-0000-7000-8000-00000000a001", amount: "16684" },
              { vehicleId: "0190d4a2-0000-7000-8000-00000000a001", amount: "0" },
            ],
          },
        })
        .error?.issues.map((issue) => issue.message),
    ).toContain("Each vehicle once");
  });

  it("has unique keys and a split preset for every Finance subcategory", () => {
    const keys = SYSTEM_EXPENSE_CATEGORIES.flatMap((c) => [
      c.key,
      ...c.subcategories.map((s) => s.key),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    const finance = SYSTEM_EXPENSE_CATEGORIES.find((c) => c.key === "FINANCE")!;
    expect(finance.subcategories.every((s) => FINANCE_COMPONENT_BY_KEY[s.key])).toBe(true);
  });
});
