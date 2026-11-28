import type { PeriodWindow } from "@automate/shared";
import { describe, expect, it } from "vitest";

import {
  type AnalyticsTrip,
  computeTripAnalytics,
  lengthBand,
  percentChange,
  timeOfDay,
  weekdayOf,
} from "./trip-analytics";

const period: PeriodWindow = {
  period: "this_month",
  from: "2026-11-01",
  to: "2026-11-28",
  previous: { from: "2026-10-01", to: "2026-10-28" },
  endsToday: true,
};
const commute = { id: "c", key: "COMMUTE" as const, name: "Commute" };
const road = { id: "r", key: "ROAD_TRIP" as const, name: "Road trip" };
let next = 0;
const trip = (overrides: Partial<AnalyticsTrip>): AnalyticsTrip => ({
  id: `t${(next += 1)}`,
  vehicleId: "v1",
  date: "2026-11-02",
  endDate: null,
  startTime: null,
  endTime: null,
  distanceKm: "20.0",
  title: null,
  origin: "Home",
  destination: "Office",
  category: commute,
  cost: null,
  ...overrides,
});
const run = (
  trips: AnalyticsTrip[],
  extra: Partial<Parameters<typeof computeTripAnalytics>[0]> = {},
) =>
  computeTripAnalytics({
    period,
    shown: { from: period.from, to: period.to },
    vehicleId: null,
    trips,
    previous: { trips: 0, distanceKm: "0.0", actualCost: null },
    fuelEstimate: null,
    lastMonthsKm: ["0.0", "0.0", "0.0"],
    ...extra,
  });

describe("trip analytics", () => {
  it("bands lengths, times of day and weekdays", () => {
    expect(["9.9", "10.0", "99.9", "100.0", "300.0"].map(lengthBand)).toEqual([
      "UNDER_10",
      "10_50",
      "50_100",
      "100_300",
      "300_PLUS",
    ]);
    expect(["05:00", "11:59", "12:00", "17:00", "21:00", "04:59"].map(timeOfDay)).toEqual([
      "MORNING",
      "MORNING",
      "AFTERNOON",
      "EVENING",
      "NIGHT",
      "NIGHT",
    ]);
    // 2 Nov 2026 is a Monday, 8 Nov a Sunday.
    expect([weekdayOf("2026-11-02"), weekdayOf("2026-11-08")]).toEqual([1, 7]);
  });

  it("never shows a change against nothing", () => {
    expect(percentChange(720, 626)).toBe(15);
    expect(percentChange(5, 0)).toBeNull();
    const empty = run([]);
    expect(empty.change).toEqual({ distance: null, trips: null, cost: null });
    expect(empty.distance.averageKm).toBeNull();
    expect(empty.insights).toEqual([]);
  });

  it("works out distance, time and cost figures exactly", () => {
    const result = run(
      [
        trip({
          distanceKm: "268.0",
          startTime: "06:10",
          endTime: "10:22",
          category: road,
          cost: "1520.00",
          destination: "Jaipur",
        }),
        trip({
          distanceKm: "12.5",
          startTime: "18:00",
          endTime: "18:30",
          cost: "40.00",
          destination: "jaipur ",
        }),
        trip({ distanceKm: "3.4", date: "2026-11-07", vehicleId: "v2" }),
      ],
      {
        previous: { trips: 2, distanceKm: "200.0", actualCost: "2000.00" },
        fuelEstimate: "1500.00",
      },
    );
    expect(result.current).toEqual({ trips: 3, distanceKm: "283.9", actualCost: "1560.00" });
    expect(result.change).toEqual({ distance: 42, trips: 50, cost: -22 });
    expect(result.distance).toMatchObject({
      averageKm: "94.6",
      perDayKm: "10.1",
      shortest: { distanceKm: "3.4" },
      longest: { distanceKm: "268.0", label: "Home → Jaipur" },
    });
    expect(result.distance.bands.map((band) => band.trips)).toEqual([1, 1, 0, 1, 0]);
    expect(result.time).toMatchObject({
      averageMinutes: 141,
      longest: { minutes: 252 },
      untimedTrips: 1,
    });
    expect(result.time.byTimeOfDay).toEqual([
      { slot: "MORNING", trips: 1 },
      { slot: "AFTERNOON", trips: 0 },
      { slot: "EVENING", trips: 1 },
      { slot: "NIGHT", trips: 0 },
    ]);
    expect(result.time.byWeekday[0]).toEqual({ weekday: 1, trips: 2, distanceKm: "280.5" });
    // Per km over the costed trips only: 1,560 ÷ 280.5 km.
    expect(result.cost).toEqual({
      actual: "1560.00",
      perKm: "5.56",
      perTrip: "780.00",
      tripsWithCost: 2,
      fuelEstimate: "1500.00",
    });
    expect(result.byVehicle).toEqual([
      { vehicleId: "v1", trips: 2, distanceKm: "280.5", actualCost: "1560.00" },
      { vehicleId: "v2", trips: 1, distanceKm: "3.4", actualCost: null },
    ]);
    expect(result.topDestinations).toEqual([{ destination: "Jaipur", trips: 2 }]);
    expect(run([trip({})], { vehicleId: "v1" }).byVehicle).toEqual([]);
  });

  it("finds insights only the records support", () => {
    const weekend = ["2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15"];
    const result = run(
      [
        ...weekend.map((date) => trip({ date, distanceKm: "40.0" })),
        trip({ date: "2026-11-03", distanceKm: "150.0", category: road, cost: "900.00" }),
      ],
      {
        previous: { trips: 4, distanceKm: "200.0", actualCost: null },
        lastMonthsKm: ["300.0", "350.0", "410.0"],
      },
    );
    expect(result.insights.map((insight) => [insight.key, insight.title])).toEqual([
      ["distance_change", "Distance up 55%"],
      ["long_trips", "1 trip of 100 km or more"],
      ["category_share", "Commute: 52% of your distance"],
      ["cost_per_km", "Trip costs averaged ₹6.00 per km"],
      ["weekdays", "Most trips were on weekends"],
      ["trend", "Monthly distance has grown for 3 months"],
    ]);
    expect(result.insights[1]!.link).toBe(
      "/trips/history?minKm=100&vehicle=all&from=2026-11-01&to=2026-11-28",
    );
    expect(result.insights[1]!.detail).toBe("They covered 150 km, 48% of your distance.");
    expect(result.insights[2]!.link).toBe(
      "/trips/history?type=c&vehicle=all&from=2026-11-01&to=2026-11-28",
    );
    // Two trips aren't enough to say anything.
    expect(run([trip({}), trip({})]).insights).toEqual([]);
  });
});
