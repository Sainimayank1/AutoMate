import { describe, expect, it } from "vitest";

import { bucketStart, bucketStarts, chooseGranularity, tripsPerWeek } from "./trip-overview";

describe("trip overview helpers", () => {
  it("chooses days, weeks or months by the period's length", () => {
    expect(chooseGranularity({ from: "2026-11-01", to: "2026-11-27" })).toBe("day");
    expect(chooseGranularity({ from: "2026-08-28", to: "2026-11-27" })).toBe("week");
    expect(chooseGranularity({ from: "2026-01-01", to: "2026-11-27" })).toBe("month");
  });

  it("starts weeks on Monday and months on the 1st", () => {
    expect(bucketStart("2026-11-27", "week")).toBe("2026-11-23"); // a Friday
    expect(bucketStart("2026-11-23", "week")).toBe("2026-11-23"); // a Monday
    expect(bucketStart("2026-11-29", "week")).toBe("2026-11-23"); // a Sunday
    expect(bucketStart("2026-11-27", "month")).toBe("2026-11-01");
  });

  it("lists every bucket so gaps show as zero", () => {
    expect(bucketStarts({ from: "2026-11-25", to: "2026-11-27" }, "day")).toEqual([
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
    expect(bucketStarts({ from: "2026-11-01", to: "2026-11-27" }, "week")).toEqual([
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
    expect(bucketStarts({ from: "2026-01-31", to: "2026-03-01" }, "month")).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("gives trips per week only over at least a week", () => {
    expect(tripsPerWeek(18, { from: "2026-11-01", to: "2026-11-30" })).toBe("4.2");
    expect(tripsPerWeek(3, { from: "2026-11-23", to: "2026-11-27" })).toBeNull();
  });
});
