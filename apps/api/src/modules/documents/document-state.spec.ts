import { describe, expect, it } from "vitest";

import { documentState, stateWindow } from "./document-state";

describe("documentState", () => {
  const today = "2026-11-28";

  it("is expired before today, expiring within 30 days (today included), else valid", () => {
    expect(documentState("2026-11-27", today)).toEqual({ state: "EXPIRED", daysLeft: -1 });
    expect(documentState("2026-11-28", today)).toEqual({ state: "EXPIRING", daysLeft: 0 });
    expect(documentState("2026-12-28", today)).toEqual({ state: "EXPIRING", daysLeft: 30 });
    expect(documentState("2026-12-29", today)).toEqual({ state: "VALID", daysLeft: 31 });
    expect(documentState(null, today)).toEqual({ state: "NO_EXPIRY", daysLeft: null });
  });

  it("filters the same windows in the database", () => {
    expect(stateWindow("EXPIRED", today)).toEqual({ lt: "2026-11-28" });
    expect(stateWindow("EXPIRING", today)).toEqual({ gte: "2026-11-28", lte: "2026-12-28" });
    expect(stateWindow("VALID", today)).toEqual({ gt: "2026-12-28" });
    expect(stateWindow("NO_EXPIRY", today)).toBeNull();
  });
});
