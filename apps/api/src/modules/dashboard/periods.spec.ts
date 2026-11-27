import { customWindow, ReportingPeriod, resolvePeriod, windowLength } from "@automate/shared";
import { describe, expect, it } from "vitest";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-27T06:00:00.000Z"); // 27 Nov 2026, 11:30 IST

describe("resolvePeriod (shared, IST)", () => {
  it("compares each period with a window of the same length", () => {
    expect(resolvePeriod(ReportingPeriod.THIS_MONTH, NOW)).toEqual({
      period: "this_month",
      from: "2026-11-01",
      to: "2026-11-27",
      previous: { from: "2026-10-01", to: "2026-10-27" }, // the same days, not all October
      endsToday: true,
    });
    expect(resolvePeriod(ReportingPeriod.LAST_MONTH, NOW)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      previous: { from: "2026-09-01", to: "2026-09-30" },
      endsToday: false,
    });
    expect(resolvePeriod(ReportingPeriod.LAST_3_MONTHS, NOW)).toMatchObject({
      from: "2026-08-28",
      to: "2026-11-27",
      previous: { from: "2026-05-28", to: "2026-08-27" },
    });
    expect(resolvePeriod(ReportingPeriod.THIS_YEAR, NOW)).toMatchObject({
      from: "2026-01-01",
      to: "2026-11-27",
      previous: { from: "2025-01-01", to: "2025-11-27" },
    });
    expect(resolvePeriod(ReportingPeriod.LAST_12_MONTHS, NOW)).toMatchObject({
      from: "2025-11-28",
      to: "2026-11-27",
      previous: { from: "2024-11-28", to: "2025-11-27" },
    });
    expect(
      resolvePeriod(ReportingPeriod.CUSTOM, NOW, { from: "2026-10-01", to: "2026-10-10" }),
    ).toMatchObject({ previous: { from: "2026-09-21", to: "2026-09-30" }, endsToday: false });
  });

  it("resolves this week (from Monday), the last 6 months and all time", () => {
    // Friday 27 Nov 2026: Monday 23rd → today, vs Monday 16th → Friday 20th.
    expect(resolvePeriod(ReportingPeriod.THIS_WEEK, NOW)).toMatchObject({
      from: "2026-11-23",
      to: "2026-11-27",
      previous: { from: "2026-11-16", to: "2026-11-20" },
    });
    // On a Monday the week is just that day.
    expect(resolvePeriod(ReportingPeriod.THIS_WEEK, at("2026-11-23T06:00:00.000Z"))).toMatchObject({
      from: "2026-11-23",
      to: "2026-11-23",
    });
    expect(resolvePeriod(ReportingPeriod.LAST_6_MONTHS, NOW)).toMatchObject({
      from: "2026-05-28",
      to: "2026-11-27",
      previous: { from: "2025-11-25", to: "2026-05-27" }, // the same 184 days just before
    });
    // All time compares with nothing: its previous window is empty (ends before it starts).
    expect(resolvePeriod(ReportingPeriod.ALL_TIME, NOW)).toMatchObject({
      from: "2000-01-01",
      to: "2026-11-27",
      previous: { from: "2000-01-01", to: "1999-12-31" },
      endsToday: true,
    });
  });

  it("clamps to shorter months and leap years", () => {
    // 31 Mar 2028 (a leap year): the same days of February end on the 29th.
    expect(resolvePeriod(ReportingPeriod.THIS_MONTH, at("2028-03-31T06:00:00.000Z"))).toMatchObject(
      { previous: { from: "2028-02-01", to: "2028-02-29" } },
    );
    // 29 Feb 2028: a year earlier there's no 29th.
    expect(resolvePeriod(ReportingPeriod.THIS_YEAR, at("2028-02-29T06:00:00.000Z"))).toMatchObject({
      previous: { from: "2027-01-01", to: "2027-02-28" },
    });
  });

  it("compares rolling periods with the same number of days just before", () => {
    // 31 May 2027: 1 Mar – 31 May (92 days) vs 29 Nov – 28 Feb (92 days).
    const window = resolvePeriod(ReportingPeriod.LAST_3_MONTHS, at("2027-05-31T06:00:00.000Z"));
    expect(window).toMatchObject({
      from: "2027-03-01",
      previous: { from: "2026-11-29", to: "2027-02-28" },
    });
    expect(windowLength(window.previous)).toBe(windowLength(window));
  });

  it("turns whatever a URL holds into a usable custom window", () => {
    expect(customWindow(undefined, undefined, NOW)).toEqual({
      from: "2026-11-01",
      to: "2026-11-27",
    });
    expect(customWindow("2026-02-30", "abc", NOW)).toEqual({
      from: "2026-11-01",
      to: "2026-11-27",
    });
    expect(customWindow("2026-10-10", "2026-10-01", NOW)).toEqual({
      from: "2026-10-01",
      to: "2026-10-10",
    });
    expect(customWindow("1990-01-01", "2030-01-01", NOW)).toEqual({
      from: "2000-01-01",
      to: "2026-11-27",
    });
  });

  it("uses the Indian calendar day", () => {
    // 31 Dec 2026, 23:30 UTC is already 1 Jan 2027 in India.
    expect(resolvePeriod(ReportingPeriod.THIS_MONTH, at("2026-12-31T23:30:00.000Z"))).toMatchObject(
      {
        from: "2027-01-01",
        to: "2027-01-01",
        previous: { from: "2026-12-01", to: "2026-12-01" },
      },
    );
  });
});
