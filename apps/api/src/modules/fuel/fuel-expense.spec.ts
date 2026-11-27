import { describe, expect, it } from "vitest";

import { type FuelEntry, Prisma } from "@/generated/prisma/client";

import { istDate, toFuelExpense } from "./fuel-expense";

const row = (overrides: Partial<FuelEntry> = {}): FuelEntry => ({
  id: "0190d4a2-0000-7000-8000-00000000f001",
  userId: "0190d4a2-0000-7000-8000-000000000001",
  vehicleId: "0190d4a2-0000-7000-8000-00000000a001",
  filledAt: new Date("2026-11-24T08:30:00.000Z"),
  odometerKm: 8412,
  fuelType: "PETROL",
  quantity: new Prisma.Decimal("32.400"),
  pricePerUnit: new Prisma.Decimal("104.320"),
  totalAmount: new Prisma.Decimal("3380.00"),
  isFullTank: true,
  missedPrevious: false,
  stationName: "IndianOil XP95",
  latitude: null,
  longitude: null,
  location: null,
  paymentMethod: "UPI",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("toFuelExpense", () => {
  it("files a fill-up under Fuel with its amount, station and odometer", () => {
    expect(toFuelExpense(row())).toEqual({
      userId: row().userId,
      vehicleId: row().vehicleId,
      source: "FUEL",
      sourceId: row().id,
      categoryKey: "FUEL",
      subcategoryKey: "FUEL.PETROL",
      title: "IndianOil XP95",
      amount: "3380.00",
      date: "2026-11-24",
      paymentMethod: "UPI",
      vendor: "IndianOil XP95",
      odometerKm: 8412,
      description: "32.4 L at ₹104.32/L",
      notes: null,
    });
  });

  it("uses the fuel's unit and subcategory, and a plain title without a station", () => {
    expect(
      toFuelExpense(
        row({
          fuelType: "CNG",
          quantity: new Prisma.Decimal("8.000"),
          pricePerUnit: new Prisma.Decimal("90.000"),
          stationName: null,
        }),
      ),
    ).toMatchObject({
      subcategoryKey: "FUEL.CNG",
      title: "Fuel fill-up",
      vendor: null,
      description: "8 kg at ₹90/kg",
    });
    expect(toFuelExpense(row({ fuelType: "ELECTRIC" }))).toMatchObject({
      subcategoryKey: "FUEL.EV_CHARGING",
    });
    expect(toFuelExpense(row({ fuelType: "HYBRID" }))).toMatchObject({
      subcategoryKey: "FUEL.PETROL",
    });
  });

  it("dates it by the day in India", () => {
    expect(istDate(new Date("2026-10-31T18:29:00.000Z"))).toBe("2026-10-31"); // 23:59 IST
    expect(istDate(new Date("2026-10-31T18:30:00.000Z"))).toBe("2026-11-01"); // 00:00 IST
  });
});
