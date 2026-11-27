import { ReportingPeriod } from "@automate/shared";
import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardService } from "./dashboard.service";

const VEHICLE = { id: "v1", odometerKm: 1000, warrantyExpiryDate: null, warrantyKmLimit: null };

/** Every source the dashboard reads, answering "nothing recorded" unless a test says otherwise. */
function sources() {
  return {
    vehicles: { get: vi.fn().mockResolvedValue(VEHICLE) },
    figures: {
      firstDate: vi.fn().mockResolvedValue(null),
      latestInsurance: vi.fn().mockResolvedValue(null),
      lastReading: vi.fn().mockResolvedValue(null),
    },
    fuel: { hasFills: vi.fn().mockResolvedValue(false) },
    maintenance: {
      snapshot: vi.fn().mockResolvedValue({
        status: { items: [], tracked: false },
        counts: { OVERDUE: 0, DUE: 0, DUE_SOON: 0, UP_TO_DATE: 0 },
        recordCount: 0,
        lastService: null,
      }),
    },
    records: {},
  };
}
const service = (deps: ReturnType<typeof sources>) =>
  new DashboardService(
    deps.vehicles as never,
    deps.figures as never,
    deps.fuel as never,
    deps.maintenance as never,
    deps.records as never,
  );
const QUERY = { vehicleId: "v1", period: ReportingPeriod.THIS_MONTH };

describe("DashboardService.overview", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  it("shows a vehicle with nothing recorded as empty sections, not zeros", async () => {
    const overview = await service(sources()).overview("u1", QUERY);
    expect(overview.metrics).toEqual({ state: "empty" });
    expect(overview.spending).toEqual({ state: "empty" });
    expect(overview.fuel).toEqual({ state: "empty" });
    expect(overview.driving).toEqual({ state: "empty" });
    expect(overview.maintenance).toEqual({ state: "empty" });
    expect(overview.status).toMatchObject({ state: "ok", data: { level: "incomplete" } });
    expect(overview.insights).toMatchObject({ state: "ok", data: { items: [] } });
  });

  it("keeps a failing source to the sections that read it", async () => {
    const deps = sources();
    deps.maintenance.snapshot.mockRejectedValue(new Error("maintenance is down"));
    deps.figures.latestInsurance.mockRejectedValue(new Error("expenses is down"));
    const overview = await service(deps).overview("u1", QUERY);

    expect(overview.maintenance).toEqual({ state: "error", message: "Couldn't load maintenance." });
    // Maintenance's snapshot and the insurance policy both feed the status; the policy also feeds
    // the expiry dates.
    expect(overview.status).toEqual({
      state: "error",
      message: "Couldn't work out the vehicle status.",
    });
    expect(overview.expiries).toEqual({
      state: "error",
      message: "Couldn't load the expiry dates.",
    });
    expect(overview.metrics).toEqual({ state: "empty" });
    expect(overview.insights.state).toBe("ok");
  });
});
