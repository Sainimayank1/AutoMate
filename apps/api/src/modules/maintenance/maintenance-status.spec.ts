import type { MaintenanceSchedule, ScheduleDue } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { maintenanceStatus } from "./maintenance-status";

const schedule = (id: string, name: string, due: Partial<ScheduleDue>) =>
  ({
    id,
    name,
    due: { decidedBy: null, date: null, distance: null, ...due },
  }) as MaintenanceSchedule;
const distance = (kmRemaining: number, nextDueKm: number) => ({
  fromKm: null,
  basis: "FIXED" as const,
  nextDueKm,
  kmRemaining,
  status: "UP_TO_DATE" as const,
});
const date = (daysRemaining: number, nextDue: string) => ({
  from: null,
  basis: "FIXED" as const,
  nextDue,
  daysRemaining,
  status: "UP_TO_DATE" as const,
});

describe("maintenanceStatus", () => {
  it("raises overdue as critical and due soon as a warning, deciding track first", () => {
    const { items, tracked } = maintenanceStatus([
      schedule("a", "Brake inspection", {
        status: "OVERDUE",
        decidedBy: "DISTANCE",
        distance: distance(-1200, 7250),
      }),
      schedule("b", "Engine oil & filter", {
        status: "DUE_SOON",
        decidedBy: "DATE",
        date: date(1, "2026-11-28"),
        distance: distance(850, 9300),
      }),
      schedule("c", "Air filter", {
        status: "UP_TO_DATE",
        decidedBy: "DISTANCE",
        distance: distance(6550, 15000),
      }),
    ]);
    expect(tracked).toBe(true);
    expect(items).toEqual([
      {
        id: "maintenance:a",
        severity: "critical",
        title: "Brake inspection is 1,200 km overdue",
        detail: "Due at 7,250 km",
        href: "/maintenance/schedules/a",
      },
      {
        id: "maintenance:b",
        severity: "warning",
        title: "Engine oil & filter due tomorrow",
        detail: "Due on 28 Nov 2026 or at 9,300 km, whichever comes first",
        href: "/maintenance/schedules/b",
      },
    ]);
  });

  it("isn't tracked without an active schedule (paused or done ones don't count)", () => {
    expect(maintenanceStatus([])).toEqual({ items: [], tracked: false });
    expect(
      maintenanceStatus([
        schedule("a", "AC service", { status: "PAUSED" }),
        schedule("b", "Recall check", { status: "COMPLETED" }),
      ]).tracked,
    ).toBe(false);
  });
});
