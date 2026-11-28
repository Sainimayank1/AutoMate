import {
  checkItinerary,
  roadTripSummary,
  stayMinutes,
  tripDays,
  tripItinerary,
  tripProgress,
} from "@automate/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const issues = (values: Parameters<typeof checkItinerary>[0]) => {
  const result = z
    .any()
    .superRefine((value: typeof values, ctx) => checkItinerary(value, ctx))
    .safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

const manali = {
  date: "2026-12-14",
  endDate: "2026-12-17",
  origin: "Hisar",
  destination: "Hisar",
  stops: [
    { label: "Chandigarh", day: 1, arrivalTime: "10:30", departureTime: "11:15" },
    { label: "Kullu", day: 1, overnight: true },
    { label: "Manali", day: 2, overnight: true },
    { label: "Solang Valley", day: 3, arrivalTime: "09:00", departureTime: "15:30" },
  ],
};

describe("road-trip itinerary", () => {
  it("counts a trip's days, start and end included", () => {
    expect(tripDays("2026-12-14", null)).toBe(1);
    expect(tripDays("2026-12-14", "2026-12-14")).toBe(1);
    expect(tripDays("2026-12-14", "2026-12-17")).toBe(4);
    // Across a month end.
    expect(tripDays("2026-12-30", "2027-01-02")).toBe(4);
  });

  it("lays the trip out day by day, each day starting where the last night was", () => {
    const days = tripItinerary(manali);
    expect(days.map((day) => [day.day, day.date, day.from, day.night, day.to])).toEqual([
      [1, "2026-12-14", "Hisar", "Kullu", null],
      [2, "2026-12-15", "Kullu", "Manali", null],
      [3, "2026-12-16", "Manali", null, null],
      // No night set on day 3: where day 4 starts is unknown, never guessed.
      [4, "2026-12-17", null, null, "Hisar"],
    ]);
    expect(days[0]!.stops.map((stop) => [stop.label, stop.stayMinutes])).toEqual([
      ["Chandigarh", 45],
      ["Kullu", null],
    ]);
    expect(days[2]!.stops[0]!.stayMinutes).toBe(390);
  });

  it("gives a stop without a day the previous stop's day", () => {
    const days = tripItinerary({ ...manali, stops: [{ label: "A", day: 2 }, { label: "B" }] });
    expect(days[1]!.stops.map((stop) => stop.label)).toEqual(["A", "B"]);
    expect(tripItinerary({ ...manali, stops: [{ label: "A" }] })[0]!.stops).toHaveLength(1);
  });

  it("refuses days out of order or past the end, and misplaced nights", () => {
    expect(issues(manali)).toEqual([]);
    expect(issues({ ...manali, endDate: "2026-12-15" })).toEqual([
      "endDate: The itinerary goes to day 3: set a later end date or move those stops",
      // Manali's night falls on what is now the last day.
      "stops.2.overnight: The last day ends at the destination",
    ]);
    expect(
      issues({
        ...manali,
        stops: [
          { label: "A", day: 2 },
          { label: "B", day: 1 },
        ],
      }),
    ).toEqual(["stops.1.day: Earlier than the stop before it"]);
    expect(
      issues({
        ...manali,
        stops: [
          { label: "A", day: 1, overnight: true },
          { label: "B", day: 1 },
        ],
      }),
    ).toEqual(["stops.0.overnight: The night is spent at the last stop of the day"]);
    expect(issues({ ...manali, stops: [{ label: "A", day: 4, overnight: true }] })).toEqual([
      "stops.0.overnight: The last day ends at the destination",
    ]);
    // A same-day trip can't have a night at all.
    expect(issues({ date: "2026-12-14", stops: [{ label: "A", overnight: true }] })).toEqual([
      "stops.0.overnight: The last day ends at the destination",
    ]);
  });

  it("measures stays only from times in order", () => {
    expect(stayMinutes({ arrivalTime: "10:30", departureTime: "11:15" })).toBe(45);
    expect(stayMinutes({ arrivalTime: "11:15", departureTime: "10:30" })).toBeNull();
    expect(stayMinutes({ arrivalTime: "10:30" })).toBeNull();
  });

  it("knows where today falls in the trip", () => {
    expect(tripProgress("2026-12-14", "2026-12-17", "2026-12-01")).toEqual({
      state: "upcoming",
      day: 0,
      of: 4,
    });
    expect(tripProgress("2026-12-14", "2026-12-17", "2026-12-15")).toEqual({
      state: "in_progress",
      day: 2,
      of: 4,
    });
    expect(tripProgress("2026-12-14", "2026-12-17", "2026-12-20").state).toBe("ended");
    expect(tripProgress("2026-12-14", null, "2026-12-14")).toEqual({
      state: "in_progress",
      day: 1,
      of: 1,
    });
  });

  it("sums a done road trip up per day, in exact paise", () => {
    expect(roadTripSummary({ ...manali, distanceKm: "1081.0", actualCost: "10250.00" })).toEqual({
      days: 4,
      nights: 2,
      kmPerDay: "270.3",
      costPerDay: "2562.50",
    });
    expect(
      roadTripSummary({ ...manali, distanceKm: "100.0", actualCost: null }).costPerDay,
    ).toBeNull();
  });
});
