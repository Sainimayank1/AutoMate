import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { blankToNull, optionalText, positiveDecimal, requiredInt } from "../common/fields.js";
import { PaymentMethod } from "../common/payment-method.js";
import { FuelType, ODOMETER_MAX_KM } from "../vehicles/vehicle.schema.js";

/** Fuel contract (module 3) shared by apps/api (validation) and apps/web (forms). */

/** What a fuel is sold in; mileage is km per this unit. */
export const FUEL_UNIT: Record<FuelType, "L" | "kg" | "kWh"> = {
  [FuelType.PETROL]: "L",
  [FuelType.DIESEL]: "L",
  [FuelType.HYBRID]: "L",
  [FuelType.CNG]: "kg",
  [FuelType.ELECTRIC]: "kWh",
};

/**
 * Fuels a vehicle of each type can log. The first is its primary fuel, which the summary's
 * quantity, price and mileage figures use. Bi-fuel CNG cars also fill petrol; hybrids burn petrol.
 */
export const FUELS_FOR_VEHICLE: Record<FuelType, readonly [FuelType, ...FuelType[]]> = {
  [FuelType.PETROL]: [FuelType.PETROL],
  [FuelType.DIESEL]: [FuelType.DIESEL],
  [FuelType.CNG]: [FuelType.CNG, FuelType.PETROL],
  [FuelType.HYBRID]: [FuelType.PETROL],
  [FuelType.ELECTRIC]: [FuelType.ELECTRIC],
};

/** How a fill-up counts towards mileage (computed by the API from the whole history). */
export const MileageStatus = {
  /** Full tank closing a reliable sequence: `mileage` is set. */
  CALCULATED: "CALCULATED",
  /** Full tank that starts (or restarts) a sequence: nothing to measure against yet. */
  BASELINE: "BASELINE",
  /** Partial fill counted in the next full tank's mileage. */
  ROLLED_IN: "ROLLED_IN",
  /** Partial fill waiting for the next full tank. */
  PENDING: "PENDING",
  /** Partial fill that can't count: no full tank before it, or the sequence broke. */
  EXCLUDED: "EXCLUDED",
} as const;
export type MileageStatus = (typeof MileageStatus)[keyof typeof MileageStatus];

// ---- amount = quantity × price, in exact integer arithmetic (no float, no decimal library).

/** "32.4" → 32400 (thousandths). Inputs are validated decimals with at most 3 places. */
const toThousandths = (value: string) => {
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
};

/** quantity × price rounded half-up to paise, e.g. ("32.4", "104.32") → "3379.97". */
export function fuelTotal(quantity: string, pricePerUnit: string): string {
  // Millionths of a rupee; at most 9999.999 × 9999.999 ≈ 1e14, well inside 2^53.
  const micro = toThousandths(quantity) * toThousandths(pricePerUnit);
  const paise = Math.floor((micro + 5000) / 10000);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/** The amount paid may differ from quantity × price by pump rounding: allow ₹1 or 1%, whichever is more. */
export function isFuelTotalPlausible(
  totalAmount: string,
  quantity: string,
  pricePerUnit: string,
): boolean {
  const expected = toThousandths(fuelTotal(quantity, pricePerUnit)) / 10;
  const paid = toThousandths(totalAmount) / 10;
  return Math.abs(paid - expected) <= Math.max(100, Math.ceil(expected / 100));
}

/** Refinement for any schema holding the three amounts; flags `totalAmount`. */
export function checkFuelTotal(
  values: { quantity?: string; pricePerUnit?: string; totalAmount?: string },
  ctx: z.RefinementCtx,
) {
  const { quantity, pricePerUnit, totalAmount } = values;
  // Zod still runs object refinements after a field failed; those fields report their own error.
  const usable = (value?: string): value is string =>
    !!value && /^\d+(\.\d{1,3})?$/.test(value) && /[1-9]/.test(value);
  if (!usable(quantity) || !usable(pricePerUnit) || !usable(totalAmount)) return;
  if (isFuelTotalPlausible(totalAmount, quantity, pricePerUnit)) return;
  const expected = Number(fuelTotal(quantity, pricePerUnit)).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
  ctx.addIssue({
    code: "custom",
    path: ["totalAmount"],
    message: `Doesn't match quantity × price (${expected})`,
  });
}

// ---- schemas

/** Clock skew allowance for "not in the future". */
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;
const EARLIEST_FILL = Date.UTC(2000, 0, 1);

export const fuelEntryBaseSchema = z.object({
  /** Optional client-generated id (offline-sync ready); the API generates one otherwise. */
  id: z.uuid("Invalid id").optional(),
  /** ISO instant, e.g. "2026-11-26T14:15:00.000Z". */
  filledAt: z.iso
    .datetime({ offset: true, error: "Enter the date and time of the fill-up" })
    .refine(
      (value) => Date.parse(value) <= Date.now() + FUTURE_TOLERANCE_MS,
      "This is in the future",
    )
    .refine((value) => Date.parse(value) >= EARLIEST_FILL, "Enter a date from 2000 onwards"),
  odometerKm: requiredInt(0, ODOMETER_MAX_KM, "Enter the odometer reading in km, e.g. 8450"),
  fuelType: z.enum(FuelType, { error: "Choose the fuel type" }),
  quantity: positiveDecimal(4, 3, "Enter the quantity, e.g. 32.4"),
  pricePerUnit: positiveDecimal(4, 3, "Enter the price per unit, e.g. 104.32"),
  totalAmount: positiveDecimal(7, 2, "Enter the amount paid, e.g. 3380"),
  /** Full tank: closes a mileage sequence. Partial: rolls into the next full tank. */
  isFullTank: z.boolean({ error: "Choose full or partial tank" }),
  /** A fill-up before this one wasn't logged: mileage restarts here instead of being overstated. */
  missedPrevious: z.boolean().optional(),
  stationName: optionalText(80),
  /**
   * Where the fill-up happened, captured from the device when the add form opens (never typed).
   * `location` is the address looked up for these coordinates (`POST /geocode/reverse`).
   */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  location: optionalText(200),
  paymentMethod: z
    .preprocess(blankToNull, z.enum(PaymentMethod, { error: "Choose a payment method" }).nullable())
    .optional(),
  notes: optionalText(500),
});

/** Coordinates come as a pair: both set, both null, or (on update) both left out. */
export function checkCoordinates(
  values: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx,
) {
  const { latitude, longitude } = values;
  if (
    (latitude === undefined) === (longitude === undefined) &&
    (latitude === null) === (longitude === null)
  ) {
    return;
  }
  ctx.addIssue({
    code: "custom",
    path: ["longitude"],
    message: "Send latitude and longitude together",
  });
}

/** Every cross-field rule of a fill-up. */
export function checkFuelEntry(
  values: Parameters<typeof checkFuelTotal>[0] & Parameters<typeof checkCoordinates>[0],
  ctx: z.RefinementCtx,
) {
  checkFuelTotal(values, ctx);
  checkCoordinates(values, ctx);
}

export const createFuelEntrySchema = fuelEntryBaseSchema.superRefine(checkFuelEntry);

/** PATCH: send only what changes. The API re-checks the amount against the merged record. */
export const updateFuelEntrySchema = fuelEntryBaseSchema
  .omit({ id: true })
  .partial()
  .superRefine(checkCoordinates);

/** `GET /vehicles/:id/fuel-entries`: newest first, optionally only full or partial fills, or a search. */
export const fuelEntryListQuerySchema = paginationQuerySchema.extend({
  tank: z.enum(["full", "partial"]).optional(),
  /** Matches station, location, notes and fuel type, case-insensitively. */
  search: z.string().trim().max(80).optional(),
});
export type FuelEntryListQuery = z.output<typeof fuelEntryListQuerySchema>;

export type CreateFuelEntryInput = z.input<typeof createFuelEntrySchema>;
export type CreateFuelEntryValues = z.output<typeof createFuelEntrySchema>;
export type UpdateFuelEntryValues = z.output<typeof updateFuelEntrySchema>;

/** A fill-up as the API returns it. Money and quantities are decimal strings. */
export interface FuelEntry {
  id: string;
  vehicleId: string;
  /** ISO instant. */
  filledAt: string;
  odometerKm: number;
  fuelType: FuelType;
  quantity: string;
  pricePerUnit: string;
  totalAmount: string;
  isFullTank: boolean;
  missedPrevious: boolean;
  stationName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Address of the coordinates, when one was found. */
  location: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  /** Kilometres since the previous fill-up; null for the first one. */
  distanceKm: number | null;
  /** km per unit (FUEL_UNIT), 2 decimals; only when `mileageStatus` is CALCULATED. */
  mileage: string | null;
  mileageStatus: MileageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MileagePoint {
  /** `filledAt` of the full tank that closed the sequence. */
  date: string;
  mileage: string;
}

/** Figures for a vehicle's fuel page and the dashboard. Computed by the API; never in the UI. */
export interface FuelSummary {
  /** The vehicle's primary fuel: quantity, price and mileage figures are in its unit. */
  fuelType: FuelType;
  fillCount: number;
  /** Every fill-up, every fuel. */
  totalSpend: string;
  totalQuantity: string;
  /** Spend ÷ quantity over every fill-up of the primary fuel. */
  averagePrice: string | null;
  /** Distance ÷ fuel over all reliable full-tank sequences (weighted, not a mean of means). */
  averageMileage: string | null;
  /** How many full-tank sequences `averageMileage` rests on. */
  mileageSequences: number;
  lastMileage: MileagePoint | null;
  bestMileage: MileagePoint | null;
  worstMileage: MileagePoint | null;
  /** Fuel cost per km over the same reliable sequences. */
  costPerKm: string | null;
  /** The current calendar month in India (IST). */
  thisMonth: { spend: string; fillCount: number; quantity: string };
  /** The latest calculated mileages, oldest first (at most 12). */
  trend: MileagePoint[];
}

// ---- reverse geocoding (the add form's automatic location)

/** Body of `POST /geocode/reverse`: a body, so coordinates never appear in request logs. */
export const reverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export interface ReverseGeocodeResult {
  /** A short address ("IndianOil, Sector 29, Gurugram, Haryana"); null when none was found. */
  address: string | null;
}
