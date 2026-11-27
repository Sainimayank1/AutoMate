import { describe, expect, it } from "vitest";

import { Prisma, type Vehicle as VehicleRow } from "@/generated/prisma/client";

import { profileCompletion, toVehicle, toVehicleData } from "./vehicles.mapper";

const minimal: VehicleRow = {
  id: "0190d4a2-0000-7000-8000-000000000001",
  userId: "0190d4a2-0000-7000-8000-0000000000aa",
  make: "Maruti Suzuki",
  model: "Victoris",
  variant: null,
  manufacturingYear: 2025,
  category: "SUV",
  registrationNumber: "HR26EV4821",
  registrationDate: null,
  fuelType: "PETROL",
  transmission: "MANUAL",
  engineCapacityCc: null,
  engineConfiguration: null,
  fuelTankCapacityL: null,
  colour: null,
  ownershipType: "OWNED",
  purchaseDate: null,
  purchasePrice: null,
  odometerKm: 8450,
  vin: null,
  engineNumber: null,
  fuelSpecification: null,
  engineOilSpecification: null,
  tyreSize: null,
  batteryType: null,
  warrantyExpiryDate: null,
  warrantyKmLimit: null,
  notes: null,
  archivedAt: null,
  createdAt: new Date("2026-11-27T05:00:00.000Z"),
  updatedAt: new Date("2026-11-27T05:00:00.000Z"),
};

describe("profileCompletion", () => {
  it("counts the required fields, so a minimal vehicle isn't 0%", () => {
    expect(profileCompletion(minimal)).toBe(38); // 9 of 24
  });

  it("reaches 100% when every applicable field is filled; notes and warranty km don't count", () => {
    const full: VehicleRow = {
      ...minimal,
      variant: "LXI",
      registrationDate: new Date("2025-02-20"),
      colour: "Pearl Silver",
      engineConfiguration: "4-cylinder",
      purchaseDate: new Date("2025-02-14"),
      purchasePrice: new Prisma.Decimal("1145000"),
      vin: "MA3EJKD1S00482910",
      engineNumber: "K15B-9284110",
      fuelSpecification: "Petrol, 91 RON",
      tyreSize: "215/60 R17",
      batteryType: "12V 45Ah",
      warrantyExpiryDate: new Date("2028-02-13"),
      engineCapacityCc: 1462,
      fuelTankCapacityL: 45,
      engineOilSpecification: "0W-16",
    };
    expect(profileCompletion(full)).toBe(100);
  });

  it("doesn't expect engine, tank or oil details from an electric vehicle", () => {
    expect(profileCompletion({ ...minimal, fuelType: "ELECTRIC" })).toBe(43); // 9 of 21
  });
});

describe("toVehicle / toVehicleData", () => {
  it("serialises dates as YYYY-MM-DD and money as a 2-decimal string", () => {
    const vehicle = toVehicle({
      ...minimal,
      purchaseDate: new Date("2025-02-14T00:00:00.000Z"),
      purchasePrice: new Prisma.Decimal("1145000"),
    });
    expect(vehicle.purchaseDate).toBe("2025-02-14");
    expect(vehicle.purchasePrice).toBe("1145000.00");
    expect(vehicle).not.toHaveProperty("userId");
  });

  it("maps input dates to UTC midnight and leaves missing fields untouched", () => {
    const data = toVehicleData({ purchaseDate: "2025-02-14", variant: null });
    expect(data).toEqual({ purchaseDate: new Date("2025-02-14T00:00:00.000Z"), variant: null });
  });
});
