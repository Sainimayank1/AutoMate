import { FUEL_CATEGORY_KEY, FUEL_UNIT, FuelType } from "@automate/shared";

import type { FuelEntry as FuelEntryRow } from "@/generated/prisma/client";
import type { LinkedExpense } from "@/modules/expenses/linked-expenses.service";

const SUBCATEGORY_BY_FUEL: Record<FuelType, string> = {
  [FuelType.PETROL]: "FUEL.PETROL",
  [FuelType.DIESEL]: "FUEL.DIESEL",
  [FuelType.CNG]: "FUEL.CNG",
  [FuelType.ELECTRIC]: "FUEL.EV_CHARGING",
  [FuelType.HYBRID]: "FUEL.PETROL",
};

const IST_OFFSET_MS = 330 * 60 * 1000;

/** The calendar day of an instant in India: a fill-up at 00:30 IST on 1 Nov belongs to November. */
export const istDate = (instant: Date) =>
  new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * A fill-up as the expense it is (Fuel → Expenses). The migration that backfilled existing
 * fill-ups builds the same fields in SQL (20261127*_link_fuel_expenses): keep them in step.
 */
export function toFuelExpense(row: FuelEntryRow): LinkedExpense {
  const unit = FUEL_UNIT[row.fuelType];
  return {
    userId: row.userId,
    vehicleId: row.vehicleId,
    source: "FUEL",
    sourceId: row.id,
    categoryKey: FUEL_CATEGORY_KEY,
    subcategoryKey: SUBCATEGORY_BY_FUEL[row.fuelType],
    title: row.stationName ?? "Fuel fill-up",
    amount: row.totalAmount.toFixed(2),
    date: istDate(row.filledAt),
    paymentMethod: row.paymentMethod,
    vendor: row.stationName,
    odometerKm: row.odometerKm,
    // "32.4 L at ₹104.32/L" (Decimal#toString drops trailing zeros, like trim_scale in SQL).
    description: `${row.quantity.toString()} ${unit} at ₹${row.pricePerUnit.toString()}/${unit}`,
    notes: row.notes,
  };
}
