import { guessTripColumns, parseCsv } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { mapRows, parseDate, parseKm, parseTime } from "./trip-import";

describe("trip CSV import", () => {
  it("guesses columns from the export's headers and common names", () => {
    expect(
      guessTripColumns([
        "Date",
        "Type",
        "From",
        "To",
        "Start km",
        "End km",
        "Distance (km)",
        "Notes",
      ]),
    ).toEqual({
      date: "Date",
      type: "Type",
      origin: "From",
      destination: "To",
      startKm: "Start km",
      endKm: "End km",
      distanceKm: "Distance (km)",
      notes: "Notes",
    });
    expect(guessTripColumns(["Trip date", "  KM ", "Purpose", "Odometer (start)"])).toEqual({
      date: "Trip date",
      distanceKm: "  KM ",
      type: "Purpose",
      startKm: "Odometer (start)",
    });
    expect(guessTripColumns(["Amount"])).toEqual({});
  });

  it("reads rows through the mapping, case and spaces aside", () => {
    const table = parseCsv('When,KM,Where to\n22/11/2026,"1,268.5",Jaipur\n23/11/2026,12,\n');
    expect(mapRows(table, { date: "when", distanceKm: " KM", destination: "Where to" })).toEqual([
      expect.objectContaining({
        line: 2,
        date: "22/11/2026",
        distanceKm: "1,268.5",
        destination: "Jaipur",
        origin: "",
      }),
      expect.objectContaining({ line: 3, date: "23/11/2026", distanceKm: "12", destination: "" }),
    ]);
    expect(mapRows(table, { date: "Date", distanceKm: "KM" })).toEqual({ unknown: ["Date"] });
  });

  it("reads km, times and dates the way people write them", () => {
    expect(["1,268.5", "268 km", " 12 ", "12.5KM", "-3", "abc"].map(parseKm)).toEqual([
      "1268.5",
      "268",
      "12",
      "12.5",
      null,
      null,
    ]);
    expect([parseTime("6:05"), parseTime("18:40")]).toEqual(["06:05", "18:40"]);
    expect([parseDate("2026-11-22"), parseDate("22/11/2026"), parseDate("31/02/2026")]).toEqual([
      "2026-11-22",
      "2026-11-22",
      null,
    ]);
  });
});
