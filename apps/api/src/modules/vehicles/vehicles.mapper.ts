import { FuelType, type UpdateVehicleValues, type Vehicle } from "@automate/shared";

import type { Prisma, Vehicle as VehicleRow } from "@/generated/prisma/client";

const DATE_FIELDS = ["registrationDate", "purchaseDate", "warrantyExpiryDate"] as const;

/** Always filled (required on create). */
const REQUIRED_FIELDS = 9;

/** Optional fields that count towards profile completion; the engine-only ones skip electric vehicles. */
const OPTIONAL_FIELDS = [
  "variant",
  "registrationDate",
  "colour",
  "engineConfiguration",
  "purchaseDate",
  "purchasePrice",
  "vin",
  "engineNumber",
  "fuelSpecification",
  "tyreSize",
  "batteryType",
  "warrantyExpiryDate",
] as const satisfies readonly (keyof VehicleRow)[];
const ENGINE_FIELDS = [
  "engineCapacityCc",
  "fuelTankCapacityL",
  "engineOilSpecification",
] as const satisfies readonly (keyof VehicleRow)[];

/** 0–100: share of the profile that is filled in, over the fields that apply to this vehicle. */
export function profileCompletion(vehicle: VehicleRow): number {
  const applicable = [
    ...OPTIONAL_FIELDS,
    ...(vehicle.fuelType === FuelType.ELECTRIC ? [] : ENGINE_FIELDS),
  ];
  const filled = applicable.filter((field) => vehicle[field] !== null).length;
  return Math.round(((REQUIRED_FIELDS + filled) / (REQUIRED_FIELDS + applicable.length)) * 100);
}

const toIsoDate = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

/** The only public shape of a vehicle row. */
export function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    variant: row.variant,
    manufacturingYear: row.manufacturingYear,
    category: row.category,
    registrationNumber: row.registrationNumber,
    registrationDate: toIsoDate(row.registrationDate),
    fuelType: row.fuelType,
    transmission: row.transmission,
    engineCapacityCc: row.engineCapacityCc,
    engineConfiguration: row.engineConfiguration,
    fuelTankCapacityL: row.fuelTankCapacityL,
    colour: row.colour,
    ownershipType: row.ownershipType,
    purchaseDate: toIsoDate(row.purchaseDate),
    purchasePrice: row.purchasePrice?.toFixed(2) ?? null,
    odometerKm: row.odometerKm,
    vin: row.vin,
    engineNumber: row.engineNumber,
    fuelSpecification: row.fuelSpecification,
    engineOilSpecification: row.engineOilSpecification,
    tyreSize: row.tyreSize,
    batteryType: row.batteryType,
    warrantyExpiryDate: toIsoDate(row.warrantyExpiryDate),
    warrantyKmLimit: row.warrantyKmLimit,
    notes: row.notes,
    profileCompletion: profileCompletion(row),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validated input → Prisma data. `undefined` stays undefined (left unchanged on update),
 * `null` clears, and YYYY-MM-DD dates become UTC-midnight Dates for the `date` columns.
 */
export function toVehicleData(
  input: UpdateVehicleValues,
): Omit<Prisma.VehicleUncheckedUpdateInput, "id" | "userId"> {
  const data: Record<string, unknown> = { ...input };
  for (const field of DATE_FIELDS) {
    const value = input[field];
    if (typeof value === "string") data[field] = new Date(`${value}T00:00:00.000Z`);
  }
  return data;
}
