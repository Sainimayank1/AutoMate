import type { RecurringPayment, Vehicle, VehicleDocument } from "@automate/shared";
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
        source: "insurance",
        state: "due_soon",
        action: { label: "Add renewal", href: "/expenses/new" },
      },
    ]);
    const title = (policyEnd: string) =>
      vehicleStatus({
        vehicle: vehicle(),
        insurance: insurance(policyEnd),
        maintenance: NONE,
        today: TODAY,
      }).items[0]!;
    expect(title("2026-11-27")).toMatchObject({
      title: "Insurance expires today",
      state: "due_today",
    });
    expect(title("2026-11-28").title).toBe("Insurance expires tomorrow");
    expect(title("2026-11-26")).toMatchObject({
      severity: "critical",
      title: "Insurance expired on 26 Nov 2026",
      state: "overdue",
    });
    expect(title("2027-08-18")).toMatchObject({
      severity: "info",
      title: "Insurance valid until 18 Aug 2027",
      state: "info",
      action: null, // nothing to do yet
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
        detail: "Add the policy in Documents.",
        href: "/documents/new?type=INSURANCE",
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

describe("the action centre", () => {
  it("gives maintenance items their state and the action that fits", () => {
    const status = vehicleStatus({
      vehicle: vehicle(),
      insurance: null,
      maintenance: {
        tracked: true,
        items: [
          {
            id: "maintenance:brakes",
            severity: "critical",
            title: "Brake inspection is 212 km overdue",
            detail: "Due at 8,200 km",
            href: "/maintenance/schedules/brakes",
          },
        ],
      },
      today: TODAY,
    });
    expect(status.items[0]).toMatchObject({
      source: "maintenance",
      state: "overdue",
      action: { label: "Log service", href: "/maintenance/records/new?schedule=brakes" },
      href: "/maintenance/schedules/brakes",
    });
  });
});

describe("payments in the action centre", () => {
  const payment = (overrides: Partial<RecurringPayment>): RecurringPayment => ({
    recurringId: "r1",
    vehicleId: "v1",
    title: "HDFC Bank EMI",
    category: {
      id: "c",
      key: "FINANCE",
      name: "Finance",
      icon: "landmark",
      costClass: "FINANCING",
    },
    dueDate: "2026-11-30",
    date: "2026-11-30",
    amount: "16607.00",
    state: "DUE",
    postponed: false,
    expenseId: null,
    loan: { loanId: "l1", number: 20, of: 60, principal: "12129.00", interest: "4478.00" },
    ...overrides,
  });

  it("lists due and overdue payments with the action to record them, not later ones", () => {
    const status = vehicleStatus({
      vehicle: vehicle(),
      insurance: null,
      maintenance: NONE,
      payments: [
        payment({}),
        payment({
          recurringId: "r2",
          title: "Society parking pass",
          dueDate: "2026-11-05",
          date: "2026-11-05",
          amount: "1500.00",
          state: "OVERDUE",
          loan: null,
        }),
        payment({
          recurringId: "r3",
          dueDate: "2026-12-30",
          date: "2026-12-30",
          state: "SCHEDULED",
        }),
      ],
      today: TODAY,
    });
    expect(status.level).toBe("attention");
    expect(status.items.map((item) => [item.title, item.state, item.detail])).toEqual([
      ["Society parking pass is overdue", "overdue", "₹1,500.00 · was due 5 Nov 2026"],
      ["HDFC Bank EMI is due in 3 days", "due_soon", "₹16,607.00 · EMI 20 of 60"],
    ]);
    expect(status.items[1]).toMatchObject({
      source: "payment",
      href: "/expenses/recurring",
      action: { label: "Record payment", href: "/expenses/recurring?pay=r1&due=2026-11-30" },
    });
  });
});

describe("documents on the dashboard", () => {
  const today = "2026-11-28";
  const document = (overrides: Partial<VehicleDocument>): VehicleDocument => ({
    id: "d1",
    vehicleId: "car",
    type: "PUC",
    name: "PUC certificate",
    number: "HR026-PUC-9921",
    issuer: "Shree Balaji PUC Centre",
    issueDate: null,
    expiryDate: "2026-12-10",
    notes: null,
    reminderDays: [30, 7, 1],
    remindOn: null,
    state: "EXPIRING",
    daysLeft: 12,
    files: [],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  });
  const insuranceDoc = document({
    id: "d2",
    type: "INSURANCE",
    name: "Motor insurance",
    issuer: "ICICI Lombard",
    expiryDate: "2027-08-18",
    state: "VALID",
    daysLeft: 263,
  });
  const expiredRsa = document({
    id: "d3",
    type: "ROADSIDE_ASSISTANCE",
    name: "Roadside assist",
    issuer: null,
    number: "MSIL-RSA-7721",
    expiryDate: "2026-11-06",
    state: "EXPIRED",
    daysLeft: -22,
  });

  it("puts expired and expiring documents in the action centre, renewing as the action", () => {
    const status = vehicleStatus({
      vehicle: vehicle(),
      insurance: { expenseId: "e1", paidOn: "2026-08-18", policyEnd: "2026-12-01" },
      maintenance: { items: [], tracked: true },
      documents: [expiredRsa, document({}), insuranceDoc],
      today,
    });
    expect(status.untracked).toEqual([]);
    expect(
      status.items.map((item) => [item.id, item.severity, item.title, item.action?.href]),
    ).toEqual([
      [
        "document:d3",
        "critical",
        "Roadside assist expired on 6 Nov 2026",
        "/documents/d3/edit?renew=1",
      ],
      [
        "document:d1",
        "warning",
        "PUC certificate expires in 12 days",
        "/documents/d1/edit?renew=1",
      ],
    ]);
  });

  it("lists documents with an expiry; the insurance payment stands in only without a policy document", () => {
    const withPolicy = expiryDates({
      vehicle: vehicle(),
      insurance: { expenseId: "e1", paidOn: "2026-08-18", policyEnd: "2026-12-01" },
      documents: [
        expiredRsa,
        document({}),
        insuranceDoc,
        document({ id: "d4", expiryDate: null, state: "NO_EXPIRY", daysLeft: null }),
      ],
      today,
    });
    expect(withPolicy.map((item) => [item.id, item.state, item.summary])).toEqual([
      ["document:d3", "expired", "Expired on 6 Nov 2026"],
      ["document:d1", "expiring", "Expires in 12 days"],
      ["document:d2", "valid", "Valid until 18 Aug 2027"],
    ]);
    const withoutPolicy = expiryDates({
      vehicle: vehicle(),
      insurance: null,
      documents: [document({})],
      today,
    });
    expect(withoutPolicy.map((item) => item.id)).toEqual(["document:d1", "insurance"]);
  });
});
