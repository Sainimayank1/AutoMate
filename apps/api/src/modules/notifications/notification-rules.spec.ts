import type {
  FuelSummary,
  MaintenanceSchedule,
  RecurringPayment,
  Reminder,
  VehicleDocument,
} from "@automate/shared";
import { inQuietHours, nextReminderDate, reminderState } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import {
  documentCandidates,
  maintenanceCandidates,
  mileageCandidate,
  paymentCandidates,
  reminderCandidates,
  summaryCandidate,
  tripCandidates,
} from "./notification-rules";

const TODAY = "2026-11-28";
const CAR = "0190d4a2-0000-7000-8000-0000000000c1";

const doc = (overrides: Partial<VehicleDocument>) =>
  ({
    id: "d1",
    vehicleId: CAR,
    type: "PUC",
    name: "PUC certificate",
    number: "HR026-PUC-9921",
    issuer: null,
    expiryDate: "2026-12-10",
    reminderDays: [30, 7, 1],
    remindOn: null,
    ...overrides,
  }) as VehicleDocument;

describe("documentCandidates", () => {
  it("raises the nearest reminder day reached, one notification per stage", () => {
    const [twelve] = documentCandidates([doc({})], TODAY);
    expect(twelve).toMatchObject({
      dedupeKey: "document:d1:2026-12-10:30",
      kind: "document.expiring",
      priority: "LOW",
      title: "PUC certificate expires on 10 Dec 2026",
      body: "PUC renewal · HR026-PUC-9921",
      href: "/documents/d1",
    });
    const [week] = documentCandidates([doc({ expiryDate: "2026-12-03" })], TODAY);
    expect(week).toMatchObject({ dedupeKey: "document:d1:2026-12-03:7", priority: "MEDIUM" });
  });

  it("says expired with high priority, nothing before the first reminder day, and remind-on dates", () => {
    expect(documentCandidates([doc({ expiryDate: "2026-11-20" })], TODAY)[0]).toMatchObject({
      dedupeKey: "document:d1:2026-11-20:expired",
      priority: "HIGH",
      title: "PUC certificate expired on 20 Nov 2026",
    });
    expect(documentCandidates([doc({ expiryDate: "2027-06-01" })], TODAY)).toEqual([]);
    expect(
      documentCandidates([doc({ expiryDate: null, remindOn: "2026-11-28" })], TODAY),
    ).toMatchObject([
      { dedupeKey: "document:d1:remind:2026-11-28", title: "Reminder: PUC certificate" },
    ]);
  });
});

const schedule = (status: string, overrides: Partial<MaintenanceSchedule> = {}) =>
  ({
    id: "s1",
    vehicleId: CAR,
    name: "Engine oil change",
    remindersEnabled: true,
    due: {
      status,
      decidedBy: "DATE",
      date: { nextDue: "2026-12-15", daysRemaining: 17, status, from: null, basis: "LAST_DONE" },
      distance: { nextDueKm: 10000, kmRemaining: 400, status, fromKm: null, basis: "LAST_DONE" },
    },
    ...overrides,
  }) as unknown as MaintenanceSchedule;

describe("maintenanceCandidates", () => {
  it("keys each cycle and stage, whichever of date or km comes first", () => {
    expect(maintenanceCandidates([schedule("DUE_SOON")])).toEqual([
      {
        dedupeKey: "maintenance:s1:2026-12-15|10000:DUE_SOON",
        category: "MAINTENANCE",
        kind: "maintenance.due_soon",
        priority: "LOW",
        title: "Engine oil change is due soon",
        body: "Due on 15 Dec 2026 or at 10,000 km, whichever comes first",
        href: "/maintenance/schedules/s1",
        vehicleId: CAR,
      },
    ]);
    expect(maintenanceCandidates([schedule("OVERDUE")])[0]).toMatchObject({ priority: "HIGH" });
  });

  it("leaves out schedules up to date, paused or with reminders off", () => {
    expect(
      maintenanceCandidates([
        schedule("UP_TO_DATE"),
        schedule("PAUSED"),
        schedule("DUE", { remindersEnabled: false }),
      ]),
    ).toEqual([]);
  });
});

describe("paymentCandidates", () => {
  const payment = (state: string): RecurringPayment =>
    ({
      recurringId: "r1",
      vehicleId: CAR,
      title: "Car loan EMI",
      dueDate: "2026-12-05",
      date: "2026-12-05",
      amount: "21280.00",
      state,
      loan: { loanId: "l1", number: 13, of: 60, principal: "15000.00", interest: "6280.00" },
    }) as RecurringPayment;

  it("raises due and overdue payments with the amount and EMI number", () => {
    expect(paymentCandidates([payment("DUE"), payment("SCHEDULED")])).toMatchObject([
      {
        dedupeKey: "payment:r1:2026-12-05:DUE",
        priority: "MEDIUM",
        title: "Car loan EMI is due on 5 Dec 2026",
        body: "₹21,280.00 · EMI 13 of 60",
        href: "/expenses/recurring?pay=r1&due=2026-12-05",
      },
    ]);
    expect(paymentCandidates([payment("OVERDUE")])[0]).toMatchObject({
      priority: "HIGH",
      title: "Car loan EMI is overdue (was due 5 Dec 2026)",
    });
  });
});

describe("tripCandidates", () => {
  it("words each trip reminder", () => {
    const [departure, unconfirmed] = tripCandidates([
      {
        kind: "departure",
        tripId: "t1",
        vehicleId: CAR,
        label: "Gurugram to Jaipur",
        date: "2026-12-02",
        days: 4,
        link: "/trips/plans/t1",
      },
      {
        kind: "unconfirmed",
        tripId: "t2",
        vehicleId: CAR,
        label: "Weekend in Rishikesh",
        date: "2026-11-24",
        days: 4,
        link: "/trips/plans/t2",
      },
    ]);
    expect(departure).toMatchObject({
      dedupeKey: "trip:t1:departure:2026-12-02",
      title: "Gurugram to Jaipur starts on 2 Dec 2026",
      href: "/trips/plans/t1",
    });
    expect(unconfirmed?.title).toBe("Did Weekend in Rishikesh happen? Mark it done");
  });
});

describe("mileageCandidate", () => {
  const summary = (last: string, average: string, cycles = 4, date = "2026-11-20T03:30:00.000Z") =>
    ({
      fuelType: "PETROL",
      lastMileage: { date, mileage: last },
      averageMileage: average,
      mileageSequences: cycles,
    }) as FuelSummary;

  it("raises a recent full tank 15% or more below the average", () => {
    expect(mileageCandidate(CAR, summary("13.00", "15.60"), TODAY)).toMatchObject({
      dedupeKey: `fuel:${CAR}:2026-11-20T03:30:00.000Z`,
      title: "Mileage dropped to 13.0 km/L",
      body: "On the full tank of 20 Nov 2026: 17% below the average of 15.6 km/L",
    });
  });

  it("stays quiet for small drops, too few cycles or an old fill", () => {
    expect(mileageCandidate(CAR, summary("14.20", "15.60"), TODAY)).toBeNull();
    expect(mileageCandidate(CAR, summary("13.00", "15.60", 2), TODAY)).toBeNull();
    expect(
      mileageCandidate(CAR, summary("13.00", "15.60", 4, "2026-09-01T03:30:00.000Z"), TODAY),
    ).toBeNull();
  });
});

describe("summaryCandidate", () => {
  it("sums last month once, and only when something was recorded", () => {
    const totals = {
      spent: new Prisma.Decimal("12450.5"),
      fuel: new Prisma.Decimal("6718.21"),
      records: 9,
      vehicles: 2,
    };
    expect(summaryCandidate("2026-10", totals)).toMatchObject({
      dedupeKey: "summary:2026-10",
      title: "Oct 2026: ₹12,450.50 spent",
      body: "Fuel ₹6,718.21 of it · across 2 vehicles",
    });
    expect(summaryCandidate("2026-10", { ...totals, records: 0 })).toBeNull();
  });
});

describe("reminders", () => {
  const reminder = (dueDate: string, remindDaysBefore = 1, doneAt: string | null = null) => {
    const base = { dueDate, remindDaysBefore, doneAt };
    return {
      id: "m1",
      vehicleId: null,
      title: "Get the tyres rotated",
      notes: null,
      ...base,
      state: reminderState(base, TODAY),
    } as Reminder;
  };

  it("is upcoming before its window, due in it, overdue after and done once marked", () => {
    expect(reminderState(reminder("2026-12-05"), TODAY)).toBe("UPCOMING");
    expect(reminderState(reminder("2026-11-29"), TODAY)).toBe("DUE");
    expect(reminderState(reminder("2026-11-28", 0), TODAY)).toBe("DUE");
    expect(reminderState(reminder("2026-11-27"), TODAY)).toBe("OVERDUE");
    expect(reminderState(reminder("2026-11-27", 1, "2026-11-27T10:00:00Z"), TODAY)).toBe("DONE");
  });

  it("raises due and overdue reminders only", () => {
    expect(
      reminderCandidates([
        reminder("2026-12-05"),
        reminder("2026-11-29"),
        reminder("2026-11-20"),
      ]).map((candidate) => [candidate.dedupeKey, candidate.priority, candidate.title]),
    ).toEqual([
      ["reminder:m1:2026-11-29:DUE", "MEDIUM", "Get the tyres rotated is due on 29 Nov 2026"],
      ["reminder:m1:2026-11-20:OVERDUE", "HIGH", "Get the tyres rotated was due on 20 Nov 2026"],
    ]);
  });
});

describe("quiet hours and repeating reminders", () => {
  it("knows quiet hours, including ones that cross midnight", () => {
    const night = { start: "22:00", end: "07:00" };
    expect(inQuietHours(night, "23:30")).toBe(true);
    expect(inQuietHours(night, "06:59")).toBe(true);
    expect(inQuietHours(night, "07:00")).toBe(false);
    expect(inQuietHours(night, "12:00")).toBe(false);
    expect(inQuietHours({ start: "13:00", end: "15:00" }, "14:00")).toBe(true);
    expect(inQuietHours(null, "03:00")).toBe(false);
  });

  it("moves a repeating reminder to its next date, skipping missed ones", () => {
    expect(nextReminderDate("2026-11-30", "MONTHLY", TODAY)).toBe("2026-12-30");
    expect(nextReminderDate("2026-01-31", "MONTHLY", "2026-01-20")).toBe("2026-02-28");
    expect(nextReminderDate("2026-11-21", "WEEKLY", TODAY)).toBe("2026-11-28");
    expect(nextReminderDate("2024-03-15", "YEARLY", TODAY)).toBe("2027-03-15");
    expect(nextReminderDate("2026-11-30", "NONE", TODAY)).toBe("2026-11-30");
  });
});
