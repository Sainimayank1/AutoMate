import type { FuelEntry } from "@automate/shared";

import type { FuelEntry as FuelEntryRow } from "@/generated/prisma/client";

import type { FillMileage } from "./fuel.calculations";

/** The only public shape of a fuel entry row, with its place in the mileage sequence. */
export function toFuelEntry(
  row: FuelEntryRow,
  { distanceKm, mileage, status }: FillMileage,
): FuelEntry {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    filledAt: row.filledAt.toISOString(),
    odometerKm: row.odometerKm,
    fuelType: row.fuelType,
    quantity: row.quantity.toFixed(3),
    pricePerUnit: row.pricePerUnit.toFixed(3),
    totalAmount: row.totalAmount.toFixed(2),
    isFullTank: row.isFullTank,
    missedPrevious: row.missedPrevious,
    stationName: row.stationName,
    latitude: row.latitude?.toNumber() ?? null,
    longitude: row.longitude?.toNumber() ?? null,
    location: row.location,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    distanceKm,
    mileage: mileage?.toFixed(2) ?? null,
    mileageStatus: status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
