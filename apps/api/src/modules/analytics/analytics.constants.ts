import { FuelType } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

import { OWNERSHIP_COST_SCHEMA } from "@/modules/expenses/expenses.constants";

type Schema = ApiResponseSchemaHost["schema"];
const money = (example: string, nullable = false): Schema => ({
  type: "string",
  nullable,
  example,
});
const MILEAGE: Schema = {
  type: "object",
  nullable: true,
  properties: {
    value: { type: "string", example: "17.20" },
    unit: { type: "string", enum: ["km/L", "km/kg", "km/kWh"] },
    cycles: { type: "integer", example: 4 },
  },
};

/** OpenAPI shape of `AnalyticsOverview` (@automate/shared). */
export const ANALYTICS_OVERVIEW_SCHEMA: Schema = {
  type: "object",
  properties: {
    period: { type: "string", enum: ["this_month", "this_year", "all_time"] },
    window: {
      type: "object",
      properties: {
        from: { type: "string", format: "date" },
        to: { type: "string", format: "date" },
      },
    },
    totals: {
      type: "object",
      properties: {
        spent: money("78480.32"),
        economic: money("177590.22"),
        cashOutflow: money("94609.32"),
        principal: money("16129.00"),
        depreciation: money("99109.90", true),
        estimatedValue: money("936610.00", true),
        distanceKm: { type: "integer", nullable: true, example: 2642 },
        costPerKm: money("67.22", true),
        perMonth: money("16292.68"),
        mileage: MILEAGE,
      },
    },
    spending: {
      type: "object",
      description: "As the dashboard's spending section, across vehicles",
    },
    vehicles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vehicleId: { type: "string", format: "uuid" },
          name: { type: "string", example: "Maruti Suzuki Victoris LXI" },
          registrationNumber: { type: "string", example: "HR26EV4821" },
          fuelType: { type: "string", enum: Object.values(FuelType) },
          odometerKm: { type: "integer", example: 8412 },
          ownership: OWNERSHIP_COST_SCHEMA,
          mileage: MILEAGE,
          serviceSpend: money("2650.00"),
        },
      },
    },
  },
};
