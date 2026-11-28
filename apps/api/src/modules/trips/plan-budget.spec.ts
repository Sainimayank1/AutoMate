import { planBudget } from "@automate/shared";
import { describe, expect, it } from "vitest";

describe("planBudget", () => {
  it("adds fuel (distance ÷ mileage × price) to the other estimates, in exact paise", () => {
    expect(
      planBudget({
        plannedDistanceKm: "512.4",
        estMileage: "18.5",
        estFuelPrice: "104.32",
        estToll: "940",
        estParking: "200",
        estAccommodation: "3500",
        estOther: null,
      }),
    ).toEqual({
      fuelQuantity: "27.7", // 512.4 / 18.5 = 27.697…
      fuelCost: "2889.38", // 512.4 / 18.5 × 104.32 = 2889.382…
      total: "7529.38",
      perKm: "14.69", // 7529.38 / 512.4 = 14.694…
    });
  });

  it("leaves out what it can't know instead of guessing", () => {
    expect(planBudget({ plannedDistanceKm: "100", estToll: "250" })).toEqual({
      fuelQuantity: null,
      fuelCost: null,
      total: "250.00",
      perKm: "2.50",
    });
    expect(planBudget({ estToll: "250" })).toMatchObject({ total: "250.00", perKm: null });
    expect(planBudget({ plannedDistanceKm: "100" })).toEqual({
      fuelQuantity: null,
      fuelCost: null,
      total: null,
      perKm: null,
    });
    expect(planBudget({ plannedDistanceKm: "100", estMileage: "20" })).toMatchObject({
      fuelQuantity: "5.0",
      fuelCost: null,
      total: null,
    });
  });
});
