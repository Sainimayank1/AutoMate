import { FuelType, OwnershipType, Transmission, VehicleCategory } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const text = (example?: string): Schema => ({ type: "string", nullable: true, example });
const int = (example?: number): Schema => ({ type: "integer", nullable: true, example });
const date = (example?: string): Schema => ({
  type: "string",
  format: "date",
  nullable: true,
  example,
});

/** OpenAPI shape of `Vehicle` (@automate/shared). */
export const VEHICLE_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    make: { type: "string", example: "Maruti Suzuki" },
    model: { type: "string", example: "Victoris" },
    variant: text("LXI"),
    manufacturingYear: { type: "integer", example: 2025 },
    category: { type: "string", enum: Object.values(VehicleCategory) },
    registrationNumber: { type: "string", example: "HR26EV4821", description: "Normalised" },
    registrationDate: date("2025-02-20"),
    fuelType: { type: "string", enum: Object.values(FuelType) },
    transmission: { type: "string", enum: Object.values(Transmission) },
    engineCapacityCc: int(1462),
    engineConfiguration: text("4-cylinder, naturally aspirated"),
    fuelTankCapacityL: int(45),
    colour: text("Pearl Silver"),
    ownershipType: { type: "string", enum: Object.values(OwnershipType) },
    purchaseDate: date("2025-02-14"),
    purchasePrice: { type: "string", nullable: true, example: "1145000.00" },
    odometerKm: { type: "integer", example: 8450 },
    vin: text("MA3EJKD1S00482910"),
    engineNumber: text("K15B-9284110"),
    fuelSpecification: text("Petrol, 91 RON, E20 compatible"),
    engineOilSpecification: text("0W-16 synthetic"),
    tyreSize: text("215/60 R17"),
    batteryType: text("12V 45Ah maintenance-free"),
    warrantyExpiryDate: date("2028-02-13"),
    warrantyKmLimit: int(100000),
    notes: text(),
    profileCompletion: { type: "integer", minimum: 0, maximum: 100, example: 92 },
    archivedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};
