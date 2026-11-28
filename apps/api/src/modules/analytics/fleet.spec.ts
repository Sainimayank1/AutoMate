import type { OwnershipCost } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { fleetTotals } from "./fleet";

const cost = (overrides: Partial<OwnershipCost>): OwnershipCost => ({
  period: "this_year",
  window: { from: "2026-01-01", to: "2026-11-28" },
  operating: "0.00",
  ownership: "0.00",
  financingCharges: "0.00",
  capital: "0.00",
  depreciation: null,
  economic: "0.00",
  cashOutflow: "0.00",
  principal: "0.00",
  distanceKm: null,
  economicPerKm: null,
  months: "10.9",
  perMonth: "0.00",
  ...overrides,
});
const depreciation = (amount: string, estimatedValue: string) => ({
  amount,
  purchasePrice: "1145000.00",
  purchaseDate: "2025-04-10",
  ageMonths: 19,
  percent: "18.2",
  estimatedValue,
  beyondSchedule: false,
});

describe("fleetTotals", () => {
  const window = { from: "2026-01-01", to: "2026-07-01" };

  it("adds money up, and depreciation, value and km only where vehicles have them", () => {
    const totals = fleetTotals(
      [
        {
          ownership: cost({
            economic: "120000.00",
            cashOutflow: "60000.00",
            principal: "20000.00",
            depreciation: depreciation("80000.00", "936610.00"),
            distanceKm: 4000,
          }),
          mileage: { value: "18.00", unit: "km/L", cycles: 3 },
        },
        {
          ownership: cost({ economic: "30000.00", cashOutflow: "30000.00" }),
          mileage: { value: "16.00", unit: "km/L", cycles: 1 },
        },
      ],
      window,
    );
    expect(totals).toEqual({
      spent: "70000.00",
      economic: "150000.00",
      cashOutflow: "90000.00",
      principal: "20000.00",
      depreciation: "80000.00",
      estimatedValue: "936610.00",
      distanceKm: 4000,
      // Only the vehicle with km: ₹1,20,000 over 4,000 km.
      costPerKm: "30.00",
      perMonth: "25000.00",
      mileage: { value: "17.50", unit: "km/L", cycles: 4 },
    });
  });

  it("leaves out what no vehicle has, and mixed mileage units", () => {
    const totals = fleetTotals(
      [
        {
          ownership: cost({ economic: "500.00" }),
          mileage: { value: "18.00", unit: "km/L", cycles: 2 },
        },
        {
          ownership: cost({ economic: "500.00" }),
          mileage: { value: "7.10", unit: "km/kWh", cycles: 2 },
        },
      ],
      window,
    );
    expect(totals).toMatchObject({
      depreciation: null,
      estimatedValue: null,
      distanceKm: null,
      costPerKm: null,
      mileage: null,
    });
  });
});
