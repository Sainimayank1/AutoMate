import { MaintenanceState, type SchedulePriority, ScheduleStatus } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { byUrgency, computeDue, overviewState, type ScheduleFacts } from "./schedule-engine";

const TODAY = "2026-11-27";

const facts = (overrides: Partial<ScheduleFacts>): ScheduleFacts => ({
  intervalKm: null,
  intervalMonths: null,
  dueDate: null,
  dueKm: null,
  lastDoneDate: null,
  lastDoneKm: null,
  addedDate: "2026-06-01",
  addedOdometerKm: 5_000,
  leadDays: null,
  leadKm: null,
  paused: false,
  completions: [],
  ...overrides,
});

describe("computeDue", () => {
  it("counts distance from the odometer when the schedule was added", () => {
    const due = computeDue(facts({ intervalKm: 10_000 }), 14_150, TODAY);
    expect(due.distance).toEqual({
      fromKm: 5_000,
      basis: "ADDED",
      nextDueKm: 15_000,
      kmRemaining: 850,
      status: ScheduleStatus.DUE_SOON,
    });
    expect(due).toMatchObject({
      status: ScheduleStatus.DUE_SOON,
      decidedBy: "DISTANCE",
      date: null,
    });
  });

  it("counts time from the last done date, in calendar months", () => {
    const due = computeDue(facts({ intervalMonths: 12, lastDoneDate: "2026-05-18" }), 8_450, TODAY);
    expect(due.date).toEqual({
      from: "2026-05-18",
      basis: "LAST_DONE",
      nextDue: "2027-05-18",
      daysRemaining: 172,
      status: ScheduleStatus.UP_TO_DATE,
    });
  });

  it("clamps to the end of a shorter month", () => {
    const due = computeDue(facts({ intervalMonths: 1, lastDoneDate: "2026-01-31" }), 0, TODAY);
    expect(due.date?.nextDue).toBe("2026-02-28");
  });

  it("takes whichever comes first when both intervals are set", () => {
    // 2,000 km left (upcoming) but the date is 5 days away (due).
    const due = computeDue(
      facts({
        intervalKm: 10_000,
        intervalMonths: 6,
        lastDoneDate: "2026-06-02",
        lastDoneKm: 4_000,
      }),
      12_000,
      TODAY,
    );
    expect(due.distance?.status).toBe(ScheduleStatus.UPCOMING);
    expect(due.date).toMatchObject({ nextDue: "2026-12-02", daysRemaining: 5 });
    expect(due).toMatchObject({ status: ScheduleStatus.DUE, decidedBy: "DATE" });
  });

  it("is overdue by distance, with the overrun as negative km", () => {
    const due = computeDue(facts({ intervalKm: 10_000, intervalMonths: 12 }), 16_200, TODAY);
    expect(due.distance?.kmRemaining).toBe(-1_200);
    expect(due).toMatchObject({ status: ScheduleStatus.OVERDUE, decidedBy: "DISTANCE" });
  });

  it("is overdue the day after a one-time due date", () => {
    const due = computeDue(facts({ dueDate: "2026-11-26" }), 8_450, TODAY);
    expect(due.date).toMatchObject({ from: null, basis: "FIXED", daysRemaining: -1 });
    expect(due.status).toBe(ScheduleStatus.OVERDUE);
  });

  it("is due, not overdue, on the due day and at the due reading", () => {
    expect(computeDue(facts({ dueDate: TODAY }), 0, TODAY).status).toBe(ScheduleStatus.DUE);
    expect(computeDue(facts({ dueKm: 8_450 }), 8_450, TODAY).status).toBe(ScheduleStatus.DUE);
  });

  it("uses the schedule's own reminder lead for due soon", () => {
    const base = { intervalMonths: 6, lastDoneDate: "2026-07-12" }; // due 12/01/2027: 46 days
    expect(computeDue(facts(base), 0, TODAY).status).toBe(ScheduleStatus.UPCOMING);
    expect(computeDue(facts({ ...base, leadDays: 60 }), 0, TODAY).status).toBe(
      ScheduleStatus.DUE_SOON,
    );
  });

  it("lets each track use its own basis", () => {
    const due = computeDue(
      facts({ intervalKm: 10_000, intervalMonths: 12, lastDoneKm: 3_000 }),
      8_450,
      TODAY,
    );
    expect(due.distance).toMatchObject({ fromKm: 3_000, basis: "LAST_DONE" });
    expect(due.date).toMatchObject({ from: "2026-06-01", basis: "ADDED" });
  });

  it("keeps the figures of a paused schedule but reports it paused", () => {
    const due = computeDue(facts({ intervalKm: 1_000, paused: true }), 9_000, TODAY);
    expect(due.status).toBe(ScheduleStatus.PAUSED);
    expect(due.distance?.status).toBe(ScheduleStatus.OVERDUE);
  });
});

describe("computeDue with logged services", () => {
  it("restarts each track from the latest completion, newer than the user's last done", () => {
    const due = computeDue(
      facts({
        intervalKm: 10_000,
        intervalMonths: 12,
        lastDoneDate: "2025-05-01",
        lastDoneKm: 1_000,
        completions: [
          { date: "2026-05-18", km: 5_120 },
          { date: "2025-11-02", km: 3_000 },
        ],
      }),
      8_450,
      TODAY,
    );
    expect(due.date).toMatchObject({
      from: "2026-05-18",
      basis: "COMPLETION",
      nextDue: "2027-05-18",
    });
    expect(due.distance).toMatchObject({ fromKm: 5_120, basis: "COMPLETION", nextDueKm: 15_120 });
  });

  it("keeps a later last done over an older logged service", () => {
    const due = computeDue(
      facts({
        intervalMonths: 6,
        lastDoneDate: "2026-09-01",
        completions: [{ date: "2026-03-01", km: null }],
      }),
      0,
      TODAY,
    );
    expect(due.date).toMatchObject({ from: "2026-09-01", basis: "LAST_DONE" });
  });

  it("restarts the date track from a service logged without a reading", () => {
    const due = computeDue(
      facts({
        intervalKm: 10_000,
        intervalMonths: 12,
        completions: [{ date: "2026-11-01", km: null }],
      }),
      8_450,
      TODAY,
    );
    expect(due.date).toMatchObject({ basis: "COMPLETION", from: "2026-11-01" });
    expect(due.distance).toMatchObject({ basis: "ADDED", fromKm: 5_000 });
  });

  it("marks a one-time schedule completed once a service completes it", () => {
    const due = computeDue(
      facts({ dueKm: 7_000, completions: [{ date: "2026-11-20", km: 8_400 }] }),
      8_450,
      TODAY,
    );
    expect(due.status).toBe(ScheduleStatus.COMPLETED);
  });
});

describe("byUrgency", () => {
  const item = (
    name: string,
    overrides: Partial<ScheduleFacts>,
    priority: SchedulePriority = "NORMAL",
  ) => ({
    name,
    priority,
    due: computeDue(facts(overrides), 8_450, TODAY),
  });

  it("orders by status, then priority, then the nearest due", () => {
    const sorted = [
      item("Paused", { intervalKm: 100, paused: true }),
      item("Later", { dueDate: "2027-01-20" }),
      item("Overdue", { dueKm: 8_000 }),
      item("Sooner", { dueDate: "2027-01-10" }),
      item("High", { dueDate: "2027-01-25" }, "HIGH"),
    ].sort(byUrgency);
    expect(sorted.map((entry) => entry.name)).toEqual([
      "Overdue",
      "High",
      "Sooner",
      "Later",
      "Paused",
    ]);
  });
});

describe("overviewState", () => {
  it("reports the most pressing state and never claims more than the data shows", () => {
    expect(overviewState(["UP_TO_DATE", "OVERDUE", "DUE"])).toBe(MaintenanceState.OVERDUE);
    expect(overviewState(["UP_TO_DATE", "DUE"])).toBe(MaintenanceState.ATTENTION);
    expect(overviewState(["UPCOMING", "UP_TO_DATE"])).toBe(MaintenanceState.UPCOMING);
    expect(overviewState(["UP_TO_DATE"])).toBe(MaintenanceState.ALL_CAUGHT_UP);
    expect(overviewState(["PAUSED"])).toBe(MaintenanceState.INCOMPLETE);
    expect(overviewState([])).toBe(MaintenanceState.INCOMPLETE);
  });
});
