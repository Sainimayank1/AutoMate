import type { Expense } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { expensesToCsv } from "./csv";

const expense = (overrides: Partial<Expense>): Expense =>
  ({
    date: "2026-11-21",
    title: "Toll",
    category: { name: "Daily usage" },
    subcategory: { name: "Toll" },
    vehicleId: "v1",
    kind: "EXPENSE",
    amount: "640.00",
    paymentMethod: "UPI",
    vendor: null,
    source: "MANUAL",
    notes: null,
    ...overrides,
  }) as Expense;

describe("expensesToCsv", () => {
  it("writes one row per expense, refunds negative, quoting what needs it", () => {
    const csv = expensesToCsv(
      [
        expense({ title: 'Delhi–Jaipur, "fast" lane', notes: "line\nbreak" }),
        expense({ kind: "REFUND", amount: "200.00", title: "Refund · Parking", source: "FUEL" }),
      ],
      () => "Maruti Suzuki Victoris",
    );
    const [header, first, second] = csv.split("\r\n");
    expect(header).toBe(
      "Date,Title,Category,Subcategory,Vehicle,Amount (INR),Payment method,Vendor,Source,Notes",
    );
    expect(first).toBe(
      // The line break stays inside its quoted cell; rows end in CRLF.
      '2026-11-21,"Delhi–Jaipur, ""fast"" lane",Daily usage,Toll,Maruti Suzuki Victoris,640.00,UPI,,Manual,"line\nbreak"',
    );
    expect(second).toContain(",-200.00,UPI,,Fuel entry,");
  });

  it("keeps spreadsheet formulas from running, but numbers stay numbers", () => {
    const csv = expensesToCsv(
      [
        expense({ title: '=HYPERLINK("http://x")', vendor: "+91 98100", notes: "@sum" }),
        expense({ kind: "REFUND", amount: "200.00" }),
      ],
      () => "Car",
    );
    const [, first, second] = csv.split("\r\n");
    expect(first).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(first).toContain("'+91 98100");
    expect(first).toContain("'@sum");
    expect(second).toContain(",-200.00,");
  });
});
