import type { Vehicle } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { expiryDates, vehicleStatus } from "./vehicle-status";

const TODAY = "2026-11-27";
const vehicle = (overrides: Partial<Vehicle> = {}) =>
  ({
    id: "car",
    odometerKm: 8450,
    warrantyExpiryDate: null,
    warrantyKmLimit: null,
    ...overrides,
  }) as Vehicle;
const insurance = (policyEnd: string) => ({
  expenseId: "pay",
  paidOn: "2026-08-18",
  policyEnd,
});

/** A vehicle without active schedules: maintenance isn't tracked. */
const NONE = { items: [], tracked: false };

describe("vehicleStatus", () => {
  it("never calls a car healthy while maintenance and documents aren't tracked", () => {
    expect(
      vehicleStatus({ vehicle: vehicle(), insurance: null, maintenance: NONE, today: TODAY }),
    ).toEqual({
      level: "incomplete",
      items: [],
      untracked: ["maintenance", "documents"],
    });
  });

  it("flags insurance by its expiry, citing the payment it comes from", () => {
    const soon = vehicleStatus({
      vehicle: vehicle(),
      insurance: insurance("2026-12-21"),
      maintenance: NONE,
      today: TODAY,
    });
    expect(soon.level).toBe("attention");
    expect(soon.items).toEqual([
      {
        id: "insurance",
        severity: "warning",
        title: "Insurance expires in 24 days",
        detail: "From your insurance payment of 18 Aug 2026",
        href: "/expenses/transactions/pay",
      },
    ]);
    const title = (policyEnd: string) =>
      vehicleStatus({
        vehicle: vehicle(),
        insurance: insurance(policyEnd),
        maintenance: NONE,
        today: TODAY,
      }).items[0]!;
    expect(title("2026-11-27").title).toBe("Insurance expires today");
    expect(title("2026-11-28").title).toBe("Insurance expires tomorrow");
    expect(title("2026-11-26")).toMatchObject({
      severity: "critical",
      title: "Insurance expired on 26 Nov 2026",
    });
    expect(title("2027-08-18")).toMatchObject({
      severity: "info",
      title: "Insurance valid until 18 Aug 2027",
    });
  });

  it("reads the warranty by date or km, whichever comes first", () => {
    const item = (overrides: Partial<Vehicle>) =>
      vehicleStatus({
        vehicle: vehicle(overrides),
        insurance: null,
        maintenance: NONE,
        today: TODAY,
      }).items[0];
    expect(item({ warrantyExpiryDate: "2028-03-14", warrantyKmLimit: 100000 })).toMatchObject({
      severity: "info",
      title: "Warranty valid until 14 Mar 2028 or 1,00,000 km",
      href: "/garage/car",
    });
    expect(item({ warrantyKmLimit: 100000 })?.title).toBe("Warranty valid up to 1,00,000 km");
    expect(
      item({ warrantyExpiryDate: "2028-03-14", warrantyKmLimit: 9300, odometerKm: 8450 }),
    ).toMatchObject({
      severity: "warning",
      title: "Warranty ends in 850 km",
      detail: "14 Mar 2028 or 9,300 km, whichever comes first",
    });
    expect(item({ warrantyExpiryDate: "2026-12-10" })).toMatchObject({
      severity: "warning",
      title: "Warranty ends in 13 days",
    });
    expect(item({ warrantyKmLimit: 8000 })).toMatchObject({
      severity: "info",
      title: "Warranty ended at 8,000 km",
    });
    expect(item({ warrantyExpiryDate: "2026-01-01" })?.title).toBe("Warranty ended on 1 Jan 2026");
  });

  it("puts the most urgent first", () => {
    const status = vehicleStatus({
      vehicle: vehicle({ warrantyKmLimit: 9000 }), // 550 km left: warning
      insurance: insurance("2026-11-01"), // expired: critical
      maintenance: NONE,
      today: TODAY,
    });
    expect(status.items.map((item) => item.severity)).toEqual(["critical", "warning"]);
  });

  it("tracks maintenance only with an active schedule, and sorts its items by severity", () => {
    const tracked = vehicleStatus({
      vehicle: vehicle({ warrantyKmLimit: 9000 }), // 550 km left: warning
      insurance: null,
      maintenance: {
        tracked: true,
        items: [
          {
            id: "maintenance:brakes",
            severity: "critical",
            title: "Brake inspection is 1,200 km overdue",
            detail: "Due at 7,250 km",
            href: "/maintenance/schedules/brakes",
          },
        ],
      },
      today: TODAY,
    });
    expect(tracked.untracked).toEqual(["documents"]);
    expect(tracked.level).toBe("attention");
    expect(tracked.items.map((item) => item.id)).toEqual(["maintenance:brakes", "warranty"]);
    // Schedules all up to date: nothing to show, but documents still keep it incomplete.
    expect(
      vehicleStatus({
        vehicle: vehicle(),
        insurance: null,
        maintenance: { items: [], tracked: true },
        today: TODAY,
      }),
    ).toEqual({ level: "incomplete", items: [], untracked: ["documents"] });
  });
});

describe("expiryDates", () => {
  it("lists insurance (saying when none is on record) and the warranty when there is one", () => {
    expect(expiryDates({ vehicle: vehicle(), insurance: null, today: TODAY })).toEqual([
      {
        id: "insurance",
        label: "Insurance",
        state: "not_added",
        summary: "No policy on record",
        detail: "Add the insurance payment with its policy dates.",
        href: "/expenses/new",
      },
    ]);
    const items = expiryDates({
      vehicle: vehicle({ warrantyExpiryDate: "2028-03-14", warrantyKmLimit: 100000 }),
      insurance: insurance("2026-12-21"),
      today: TODAY,
    });
    expect(items).toEqual([
      expect.objectContaining({
        id: "insurance",
        state: "expiring",
        summary: "Expires in 24 days",
      }),
      expect.objectContaining({
        id: "warranty",
        state: "valid",
        summary: "Valid until 14 Mar 2028 or 1,00,000 km",
        href: "/garage/car",
      }),
    ]);
    expect(
      expiryDates({
        vehicle: vehicle({ warrantyKmLimit: 8000 }),
        insurance: insurance("2026-11-01"),
        today: TODAY,
      }),
    ).toEqual([
      expect.objectContaining({ state: "expired", summary: "Expired on 1 Nov 2026" }),
      expect.objectContaining({ state: "expired", summary: "Ended at 8,000 km" }),
    ]);
  });
});
