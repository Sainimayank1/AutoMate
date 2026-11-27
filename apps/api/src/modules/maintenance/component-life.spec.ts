import { describe, expect, it } from "vitest";

import { componentLife, componentStatus, warrantyActive } from "./component-life";

const TODAY = "2026-11-27";
const battery = {
  installedAt: "2025-02-14",
  installedKm: 1_020,
  expectedLifeKm: 40_000,
  expectedLifeMonths: 48,
};

describe("componentLife", () => {
  it("estimates life per track and takes the most used", () => {
    expect(componentLife(battery, 19_420, TODAY)).toEqual({
      kmUsed: 18_400,
      kmRemaining: 21_600,
      estimatedKm: 41_020,
      monthsUsed: 21,
      daysRemaining: 810,
      estimatedDate: "2029-02-14",
      fractionUsed: 0.46, // distance (18,400 of 40,000 km) beats time (651 of 1,461 days: 0.446)
      decidedBy: "DISTANCE",
    });
  });

  it("names the track nearer its end", () => {
    expect(componentLife({ ...battery, expectedLifeKm: 100_000 }, 19_420, TODAY)?.decidedBy).toBe(
      "TIME",
    );
  });

  it("goes past 1 after the estimate, and needs a lifespan with its install point", () => {
    expect(
      componentLife({ ...battery, expectedLifeMonths: null }, 45_000, TODAY)?.fractionUsed,
    ).toBe(1.1);
    expect(
      componentLife({ ...battery, expectedLifeKm: null, expectedLifeMonths: null }, 9_000, TODAY),
    ).toBeNull();
    expect(
      componentLife({ ...battery, installedKm: null, expectedLifeMonths: null }, 9_000, TODAY),
    ).toBeNull();
  });
});

describe("warrantyActive", () => {
  it("ends at whichever of date or km comes first", () => {
    const part = { warrantyUntil: "2028-02-14", warrantyKm: 60_000 };
    expect(warrantyActive(part, 8_450, TODAY)).toBe(true);
    expect(warrantyActive(part, 60_001, TODAY)).toBe(false);
    expect(warrantyActive({ warrantyUntil: "2026-11-26", warrantyKm: null }, 0, TODAY)).toBe(false);
    expect(warrantyActive({ warrantyUntil: null, warrantyKm: null }, 0, TODAY)).toBeNull();
  });
});

describe("componentStatus", () => {
  const fitted = { state: "INSTALLED" as const, condition: "GOOD" as const };
  const life = (fractionUsed: number) => ({
    ...componentLife(battery, 9_000, TODAY)!,
    fractionUsed,
  });

  it("reports the most telling status first", () => {
    expect(componentStatus({ ...fitted, state: "REPLACED" }, null, [])).toBe("REPLACED");
    expect(componentStatus({ ...fitted, condition: "FAILED" }, null, ["OVERDUE"])).toBe("FAILED");
    expect(componentStatus(fitted, life(0.92), [])).toBe("REPLACEMENT_APPROACHING");
    expect(componentStatus({ ...fitted, condition: "REPLACE_SOON" }, null, [])).toBe(
      "REPLACEMENT_APPROACHING",
    );
    expect(componentStatus(fitted, life(0.5), ["DUE_SOON"])).toBe("INSPECTION_DUE");
    expect(componentStatus({ ...fitted, condition: "NEEDS_ATTENTION" }, null, ["UPCOMING"])).toBe(
      "MONITORING",
    );
    expect(componentStatus(fitted, null, [])).toBe("GOOD");
    expect(componentStatus({ ...fitted, condition: "UNKNOWN" }, null, [])).toBe("UNKNOWN");
  });
});
