import { fuelTotal, FuelType, isFuelTotalPlausible, MileageStatus } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";

import { computeMileage, type FuelFill, summarize } from "./fuel.calculations";

let sequence = 0;
/** A fill-up; `quantity` in litres, `price` per litre, at the given day of 2026 (UTC noon). */
function fill(
  date: string,
  odometerKm: number,
  quantity: string,
  options: Partial<Pick<FuelFill, "isFullTank" | "missedPrevious" | "fuelType">> & {
    price?: string;
  } = {},
): FuelFill {
  const { price = "100", ...flags } = options;
  return {
    id: `fill-${++sequence}`,
    filledAt: new Date(`${date}T12:00:00.000Z`),
    odometerKm,
    fuelType: FuelType.PETROL,
    quantity: new Prisma.Decimal(quantity),
    totalAmount: new Prisma.Decimal(quantity).times(price),
    isFullTank: true,
    missedPrevious: false,
    ...flags,
  };
}

const statuses = (fills: FuelFill[]) => {
  const { perFill } = computeMileage(fills);
  return fills.map((item) => perFill.get(item.id)!.status);
};
const mileageOf = (fills: FuelFill[], target: FuelFill) =>
  computeMileage(fills).perFill.get(target.id)!.mileage?.toFixed(2) ?? null;

describe("computeMileage", () => {
  it("measures between two full tanks", () => {
    const first = fill("2026-09-01", 1000, "30");
    const second = fill("2026-09-15", 1500, "25");
    const { perFill } = computeMileage([first, second]);

    expect(perFill.get(first.id)).toMatchObject({
      status: MileageStatus.BASELINE,
      distanceKm: null,
    });
    expect(perFill.get(second.id)).toMatchObject({
      status: MileageStatus.CALCULATED,
      distanceKm: 500,
    });
    expect(mileageOf([first, second], second)).toBe("20.00");
  });

  it("rolls partial fills into the next full tank", () => {
    const fills = [
      fill("2026-09-01", 1000, "30"),
      fill("2026-09-08", 1200, "10", { isFullTank: false }),
      fill("2026-09-15", 1500, "15"),
    ];
    expect(statuses(fills)).toEqual([
      MileageStatus.BASELINE,
      MileageStatus.ROLLED_IN,
      MileageStatus.CALCULATED,
    ]);
    // 500 km on 10 + 15 L, not 300 km on 15 L.
    expect(mileageOf(fills, fills[2]!)).toBe("20.00");
  });

  it("never counts partial fills with no full tank before them", () => {
    const fills = [
      fill("2026-09-01", 900, "12", { isFullTank: false }),
      fill("2026-09-05", 1000, "20"),
      fill("2026-09-15", 1500, "25"),
    ];
    expect(statuses(fills)).toEqual([
      MileageStatus.EXCLUDED,
      MileageStatus.BASELINE,
      MileageStatus.CALCULATED,
    ]);
    expect(mileageOf(fills, fills[2]!)).toBe("20.00");
  });

  it("leaves partial fills after the last full tank pending", () => {
    const fills = [
      fill("2026-09-01", 1000, "30"),
      fill("2026-09-08", 1200, "10", { isFullTank: false }),
    ];
    expect(statuses(fills)).toEqual([MileageStatus.BASELINE, MileageStatus.PENDING]);
  });

  it("restarts the sequence after a missed fill-up instead of overstating mileage", () => {
    const fills = [
      fill("2026-09-01", 1000, "30"),
      fill("2026-09-08", 1200, "10", { isFullTank: false }),
      fill("2026-09-20", 1900, "28", { missedPrevious: true }),
      fill("2026-09-30", 2400, "25"),
    ];
    expect(statuses(fills)).toEqual([
      MileageStatus.BASELINE,
      MileageStatus.EXCLUDED,
      MileageStatus.BASELINE,
      MileageStatus.CALCULATED,
    ]);
    expect(mileageOf(fills, fills[3]!)).toBe("20.00");
  });

  it("restarts when the fuel changes (bi-fuel CNG)", () => {
    const fills = [
      fill("2026-09-01", 1000, "8", { fuelType: FuelType.CNG }),
      fill("2026-09-03", 1100, "5", { fuelType: FuelType.PETROL, isFullTank: false }),
      fill("2026-09-10", 1300, "7", { fuelType: FuelType.CNG }),
      fill("2026-09-17", 1500, "8", { fuelType: FuelType.CNG }),
    ];
    expect(statuses(fills)).toEqual([
      MileageStatus.BASELINE,
      MileageStatus.EXCLUDED,
      MileageStatus.BASELINE,
      MileageStatus.CALCULATED,
    ]);
    expect(mileageOf(fills, fills[3]!)).toBe("25.00");
  });

  it("gives no mileage for a full tank at the same reading", () => {
    const fills = [fill("2026-09-01", 1000, "30"), fill("2026-09-01", 1000, "2")];
    expect(statuses(fills)).toEqual([MileageStatus.BASELINE, MileageStatus.BASELINE]);
  });

  it("works on history in any order and rounds to 2 decimals", () => {
    const first = fill("2026-09-01", 1000, "30");
    const second = fill("2026-09-15", 1548, "32.4");
    expect(mileageOf([second, first], second)).toBe("16.91"); // 548 / 32.4 = 16.9135…
  });
});

describe("summarize", () => {
  const now = new Date("2026-11-27T06:00:00.000Z");

  it("weights the average by fuel, ranks best and worst, and prices per km", () => {
    const fills = [
      fill("2026-09-01", 1000, "40", { price: "100" }),
      fill("2026-09-15", 1300, "20", { price: "100" }), // 15.00 km/L
      fill("2026-09-30", 1500, "10", { price: "110" }), // 20.00 km/L
    ];
    const summary = summarize(fills, FuelType.PETROL, now);

    // (300 + 200) km / (20 + 10) L = 16.67, not the mean of 15 and 20 (17.50).
    expect(summary.averageMileage).toBe("16.67");
    expect(summary.mileageSequences).toBe(2);
    expect(summary.bestMileage).toEqual({
      date: fills[2]!.filledAt.toISOString(),
      mileage: "20.00",
    });
    expect(summary.worstMileage).toEqual({
      date: fills[1]!.filledAt.toISOString(),
      mileage: "15.00",
    });
    expect(summary.lastMileage?.mileage).toBe("20.00");
    // (2000 + 1100) / 500 km; the baseline's 4000 isn't fuel used in a measured sequence.
    expect(summary.costPerKm).toBe("6.20");
    expect(summary.totalSpend).toBe("7100.00");
    expect(summary.averagePrice).toBe("101.43"); // 7100 / 70 L
    expect(summary.trend.map((point) => point.mileage)).toEqual(["15.00", "20.00"]);
  });

  it("counts this month in IST", () => {
    const fills = [
      { ...fill("2026-10-31", 1000, "10"), filledAt: new Date("2026-10-31T19:00:00.000Z") }, // 1 Nov, 00:30 IST
      { ...fill("2026-10-31", 900, "5"), filledAt: new Date("2026-10-31T18:00:00.000Z") }, // 31 Oct, 23:30 IST
    ];
    expect(summarize(fills, FuelType.PETROL, now).thisMonth).toEqual({
      spend: "1000.00",
      fillCount: 1,
      quantity: "10.000",
    });
  });

  it("uses the primary fuel for quantity, price and mileage, and every fuel for spend", () => {
    const fills = [
      fill("2026-11-01", 1000, "8", { fuelType: FuelType.CNG, price: "90" }),
      fill("2026-11-10", 1200, "8", { fuelType: FuelType.CNG, price: "90" }),
      fill("2026-11-12", 1250, "5", { fuelType: FuelType.PETROL, isFullTank: false, price: "100" }),
    ];
    const summary = summarize(fills, FuelType.CNG, now);
    expect(summary).toMatchObject({
      fuelType: FuelType.CNG,
      totalQuantity: "16.000",
      averagePrice: "90.00",
      averageMileage: "25.00",
      totalSpend: "1940.00",
      thisMonth: { spend: "1940.00", fillCount: 3, quantity: "16.000" },
    });
  });

  it("reports nothing it can't support on an empty or unmeasured history", () => {
    expect(summarize([], FuelType.PETROL, now)).toMatchObject({
      fillCount: 0,
      totalSpend: "0.00",
      averagePrice: null,
      averageMileage: null,
      lastMileage: null,
      bestMileage: null,
      worstMileage: null,
      costPerKm: null,
      trend: [],
    });
    expect(
      summarize([fill("2026-11-01", 1000, "30")], FuelType.PETROL, now).averageMileage,
    ).toBeNull();
  });
});

describe("fuel amount (shared)", () => {
  it("multiplies exactly and rounds half-up to paise", () => {
    expect(fuelTotal("32.4", "104.32")).toBe("3379.97"); // 3379.968
    expect(fuelTotal("1", "0.005")).toBe("0.01"); // half-up
    expect(fuelTotal("1", "0.004")).toBe("0.00");
    expect(fuelTotal("9999.999", "9999.999")).toBe("99999980.00");
  });

  it("accepts pump rounding but not typos", () => {
    expect(isFuelTotalPlausible("3380", "32.4", "104.32")).toBe(true);
    expect(isFuelTotalPlausible("2000", "19.17", "104.32")).toBe(true); // filled "₹2,000 worth"
    expect(isFuelTotalPlausible("3480", "32.4", "104.32")).toBe(false);
    expect(isFuelTotalPlausible("338", "32.4", "104.32")).toBe(false);
  });
});
