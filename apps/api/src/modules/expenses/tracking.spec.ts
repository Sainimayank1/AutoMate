import { describe, expect, it } from "vitest";

import { trackedFrom } from "./tracking";

describe("trackedFrom", () => {
  const now = new Date("2026-11-27T06:00:00.000Z");
  it("starts tracking today for a schedule that started in the past (those dates were dealt with)", () => {
    expect(trackedFrom("2025-04-05", now)).toBe("2026-11-27");
  });
  it("starts at the first due date when it's still ahead", () => {
    expect(trackedFrom("2026-12-05", now)).toBe("2026-12-05");
  });
});
