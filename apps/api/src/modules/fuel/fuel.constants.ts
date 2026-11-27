import { FuelType, MileageStatus, PaymentMethod } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const decimal = (example: string, nullable = false): Schema => ({
  type: "string",
  nullable,
  example,
});
const text = (example?: string): Schema => ({ type: "string", nullable: true, example });
const point: Schema = {
  type: "object",
  nullable: true,
  properties: { date: { type: "string", format: "date-time" }, mileage: decimal("17.40") },
};

/** OpenAPI shape of `FuelEntry` (@automate/shared). */
export const FUEL_ENTRY_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid" },
    filledAt: { type: "string", format: "date-time" },
    odometerKm: { type: "integer", example: 8412 },
    fuelType: { type: "string", enum: Object.values(FuelType) },
    quantity: decimal("32.400"),
    pricePerUnit: decimal("104.320"),
    totalAmount: decimal("3380.00"),
    isFullTank: { type: "boolean" },
    missedPrevious: { type: "boolean" },
    stationName: text("IndianOil COCO, Sector 29"),
    latitude: { type: "number", nullable: true, example: 28.4595 },
    longitude: { type: "number", nullable: true, example: 77.0726 },
    location: text("IndianOil COCO, Sector 29, Gurugram, Haryana"),
    paymentMethod: { type: "string", nullable: true, enum: Object.values(PaymentMethod) },
    notes: text(),
    distanceKm: { type: "integer", nullable: true, example: 548 },
    mileage: decimal("17.40", true),
    mileageStatus: { type: "string", enum: Object.values(MileageStatus) },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `FuelSummary` (@automate/shared). */
export const FUEL_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    fuelType: { type: "string", enum: Object.values(FuelType) },
    fillCount: { type: "integer", example: 14 },
    totalSpend: decimal("45230.50"),
    totalQuantity: decimal("432.800"),
    averagePrice: decimal("104.40", true),
    averageMileage: decimal("16.80", true),
    mileageSequences: { type: "integer", example: 9 },
    lastMileage: point,
    bestMileage: point,
    worstMileage: point,
    costPerKm: decimal("6.25", true),
    thisMonth: {
      type: "object",
      properties: {
        spend: decimal("7120.00"),
        fillCount: { type: "integer", example: 2 },
        quantity: decimal("68.200"),
      },
    },
    trend: { type: "array", items: point },
  },
};
