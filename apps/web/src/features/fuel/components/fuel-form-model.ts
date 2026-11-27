import {
  checkFuelEntry,
  type FuelEntry,
  fuelEntryBaseSchema,
  FUELS_FOR_VEHICLE,
  type FuelType,
  type PaymentMethod,
  type Vehicle,
} from "@automate/shared";
import { format, parseISO } from "date-fns";
import { z } from "zod";

/**
 * Form state for adding and editing a fill-up: inputs hold strings, `fuelFormSchema` turns them
 * into the API payload ("1,481.34" → "1481.34", "" → null).
 */
export type FuelFormValues = {
  vehicleId: string;
  /** A `datetime-local` value in the browser's time zone, e.g. "2026-11-26T19:45". */
  filledAt: string;
  odometerKm: string;
  fuelType: FuelType;
  quantity: string;
  pricePerUnit: string;
  totalAmount: string;
  isFullTank: boolean;
  missedPrevious: boolean;
  stationName: string;
  paymentMethod: PaymentMethod | "";
  /** Set from the device, never typed: see `LocationField`. */
  latitude: number | null;
  longitude: number | null;
  location: string;
  notes: string;
};

export const toLocalDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

/** The shared schema, plus the vehicle (it goes in the URL, not the body) and the local date-time. */
export const fuelFormSchema = fuelEntryBaseSchema
  .omit({ id: true })
  .extend({
    vehicleId: z.string().min(1, "Choose a vehicle"),
    filledAt: z
      .string()
      .min(1, "Enter the date and time of the fill-up")
      .transform((local, ctx) => {
        const date = new Date(local);
        if (Number.isNaN(date.getTime())) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
          return z.NEVER;
        }
        return date.toISOString();
      })
      .pipe(fuelEntryBaseSchema.shape.filledAt),
  })
  .superRefine(checkFuelEntry);

export type FuelFormOutput = z.output<typeof fuelFormSchema>;

/** "32.400" → "32.4", "3380.00" → "3380": what a person would type. */
const trimDecimal = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);

/** New fill-up: now, a full tank of the vehicle's main fuel, at the last price and payment method. */
export function newFuelForm(vehicle: Vehicle, history: FuelEntry[] = []): FuelFormValues {
  const fuelType = FUELS_FOR_VEHICLE[vehicle.fuelType][0];
  const last = history.find((entry) => entry.fuelType === fuelType);
  return {
    vehicleId: vehicle.id,
    filledAt: toLocalDateTime(new Date()),
    odometerKm: "",
    fuelType,
    quantity: "",
    pricePerUnit: last ? trimDecimal(last.pricePerUnit) : "",
    totalAmount: "",
    isFullTank: true,
    missedPrevious: false,
    stationName: "",
    paymentMethod: history[0]?.paymentMethod ?? "",
    latitude: null,
    longitude: null,
    location: "",
    notes: "",
  };
}

export function toFuelForm(entry: FuelEntry): FuelFormValues {
  return {
    vehicleId: entry.vehicleId,
    filledAt: toLocalDateTime(parseISO(entry.filledAt)),
    odometerKm: String(entry.odometerKm),
    fuelType: entry.fuelType,
    quantity: trimDecimal(entry.quantity),
    pricePerUnit: trimDecimal(entry.pricePerUnit),
    totalAmount: trimDecimal(entry.totalAmount),
    isFullTank: entry.isFullTank,
    missedPrevious: entry.missedPrevious,
    stationName: entry.stationName ?? "",
    paymentMethod: entry.paymentMethod ?? "",
    latitude: entry.latitude,
    longitude: entry.longitude,
    location: entry.location ?? "",
    notes: entry.notes ?? "",
  };
}
