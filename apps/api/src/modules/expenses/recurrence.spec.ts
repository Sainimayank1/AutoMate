import { PaymentState, RecurrenceUnit } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { dueDateAt, dueDates, type Recurrence, stateOf } from "./recurrence";

const monthly = (startDate: string, overrides: Partial<Recurrence> = {}): Recurrence => ({
  startDate,
  endDate: null,
  every: 1,
  unit: RecurrenceUnit.MONTH,
  ...overrides,
});

describe("dueDates", () => {
  it("keeps a month-end schedule on each month's last day and back on the 31st", () => {
    expect(dueDates(monthly("2026-01-31"), "2026-01-01", "2026-05-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("covers weekly, quarterly, yearly and custom frequencies, and stops at the end date", () => {
    expect(
      dueDates(monthly("2026-11-02", { unit: RecurrenceUnit.WEEK }), "2026-11-10", "2026-11-30"),
    ).toEqual(["2026-11-16", "2026-11-23", "2026-11-30"]);
    expect(dueDates(monthly("2026-01-15", { every: 3 }), "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15",
    ]);
    expect(
      dueDates(monthly("2024-02-29", { unit: RecurrenceUnit.YEAR }), "2025-01-01", "2028-12-31"),
    ).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
    expect(
      dueDates(
        monthly("2026-11-01", { every: 10, unit: RecurrenceUnit.DAY, endDate: "2026-11-25" }),
        "2026-11-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-11-01", "2026-11-11", "2026-11-21"]);
  });

  it("finds dates far from the start without scanning from it", () => {
    expect(dueDates(monthly("2001-03-10"), "2026-11-01", "2026-12-31")).toEqual([
      "2026-11-10",
      "2026-12-10",
    ]);
    expect(dueDateAt(monthly("2001-03-10"), 308)).toBe("2026-11-10");
  });
});

describe("stateOf", () => {
  const today = "2026-11-27";
  it("works out scheduled, due and overdue from today, and keeps paid and skipped", () => {
    expect(stateOf("2026-11-20", undefined, today, 3)).toBe(PaymentState.OVERDUE);
    expect(stateOf("2026-11-27", undefined, today, 3)).toBe(PaymentState.DUE);
    expect(stateOf("2026-11-30", undefined, today, 3)).toBe(PaymentState.DUE);
    expect(stateOf("2026-12-01", undefined, today, 3)).toBe(PaymentState.SCHEDULED);
    const acted = { dueDate: "2026-11-20", postponedTo: null, skipped: false, expenseId: "e1" };
    expect(stateOf("2026-11-20", acted, today, 3)).toBe(PaymentState.PAID);
    expect(stateOf("2026-11-20", { ...acted, expenseId: null, skipped: true }, today, 3)).toBe(
      PaymentState.SKIPPED,
    );
    // Postponed: due when it was moved to.
    expect(
      stateOf("2026-11-20", { ...acted, expenseId: null, postponedTo: "2026-12-15" }, today, 3),
    ).toBe(PaymentState.SCHEDULED);
  });
});
