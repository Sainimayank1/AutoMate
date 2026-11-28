import {
  type FuelEntry,
  maintenanceCategoryName,
  type ServiceRecord,
  type Vehicle,
} from "@automate/shared";

import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import {
  CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
} from "@/features/garage/constants";
import { RECORD_TYPE_LABELS } from "@/features/maintenance/constants";
import { toCsv } from "@/utils/csv";

/** Fill-ups as CSV, oldest first. Times stay ISO; mileage only where a full-tank sequence gives one. */
export function fillsToCsv(fills: FuelEntry[]): string {
  const rows = [...fills]
    .sort((a, b) => a.filledAt.localeCompare(b.filledAt))
    .map((fill) => [
      fill.filledAt,
      fill.odometerKm,
      FUEL_TYPE_LABELS[fill.fuelType],
      fill.quantity,
      fill.pricePerUnit,
      fill.totalAmount,
      fill.isFullTank ? "Full" : "Partial",
      fill.distanceKm,
      fill.mileage,
      fill.stationName,
      fill.location,
      fill.paymentMethod && PAYMENT_METHOD_LABELS[fill.paymentMethod],
      fill.notes,
    ]);
  return toCsv([
    [
      "Filled at",
      "Odometer (km)",
      "Fuel",
      "Quantity",
      "Price per unit (INR)",
      "Amount (INR)",
      "Tank",
      "Distance (km)",
      "Mileage",
      "Station",
      "Location",
      "Payment method",
      "Notes",
    ],
    ...rows,
  ]);
}

/** Service records as CSV, oldest first; items joined with "; ". */
export function serviceRecordsToCsv(records: ServiceRecord[]): string {
  const rows = [...records]
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
    .map((record) => [
      record.serviceDate,
      RECORD_TYPE_LABELS[record.type],
      record.title,
      maintenanceCategoryName(record.categoryKey),
      record.odometerKm,
      record.provider?.name,
      record.labourAmount,
      record.partsAmount,
      record.otherAmount,
      record.taxAmount,
      record.discountAmount,
      record.totalAmount,
      record.paymentMethod && PAYMENT_METHOD_LABELS[record.paymentMethod],
      record.items.map((item) => item.name).join("; "),
      record.warrantyUntil,
      record.notes,
    ]);
  return toCsv([
    [
      "Date",
      "Type",
      "Title",
      "Category",
      "Odometer (km)",
      "Workshop",
      "Labour (INR)",
      "Parts (INR)",
      "Other (INR)",
      "Tax (INR)",
      "Discount (INR)",
      "Total (INR)",
      "Payment method",
      "Items",
      "Warranty until",
      "Notes",
    ],
    ...rows,
  ]);
}

/** One vehicle's details as Field, Value rows. */
export function vehicleToCsv(vehicle: Vehicle): string {
  return toCsv([
    ["Field", "Value"],
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Variant", vehicle.variant],
    ["Year", vehicle.manufacturingYear],
    ["Category", CATEGORY_LABELS[vehicle.category]],
    ["Registration number", vehicle.registrationNumber],
    ["Registration date", vehicle.registrationDate],
    ["Fuel", FUEL_TYPE_LABELS[vehicle.fuelType]],
    ["Transmission", TRANSMISSION_LABELS[vehicle.transmission]],
    ["Engine (cc)", vehicle.engineCapacityCc],
    ["Engine configuration", vehicle.engineConfiguration],
    ["Tank (L)", vehicle.fuelTankCapacityL],
    ["Colour", vehicle.colour],
    ["Ownership", OWNERSHIP_LABELS[vehicle.ownershipType]],
    ["Purchase date", vehicle.purchaseDate],
    ["Purchase price (INR)", vehicle.purchasePrice],
    ["Odometer (km)", vehicle.odometerKm],
    ["VIN", vehicle.vin],
    ["Engine number", vehicle.engineNumber],
    ["Fuel specification", vehicle.fuelSpecification],
    ["Engine oil", vehicle.engineOilSpecification],
    ["Tyre size", vehicle.tyreSize],
    ["Battery", vehicle.batteryType],
    ["Warranty until", vehicle.warrantyExpiryDate],
    ["Warranty limit (km)", vehicle.warrantyKmLimit],
    ["Notes", vehicle.notes],
  ]);
}
