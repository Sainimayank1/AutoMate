import { z } from "zod";

/** Vehicle contract (Garage, module 2) shared by apps/api (validation) and apps/web (forms). */

export const FuelType = {
  PETROL: "PETROL",
  DIESEL: "DIESEL",
  CNG: "CNG",
  ELECTRIC: "ELECTRIC",
  HYBRID: "HYBRID",
} as const;
export type FuelType = (typeof FuelType)[keyof typeof FuelType];

export const Transmission = {
  MANUAL: "MANUAL",
  AMT: "AMT",
  IMT: "IMT",
  CVT: "CVT",
  DCT: "DCT",
  AUTOMATIC: "AUTOMATIC",
} as const;
export type Transmission = (typeof Transmission)[keyof typeof Transmission];

export const VehicleCategory = {
  HATCHBACK: "HATCHBACK",
  SEDAN: "SEDAN",
  SUV: "SUV",
  MUV: "MUV",
  OTHER: "OTHER",
} as const;
export type VehicleCategory = (typeof VehicleCategory)[keyof typeof VehicleCategory];

/** Leased and family vehicles are planned (MODULES.md M2); loan details arrive with Expenses/EMI. */
export const OwnershipType = {
  OWNED: "OWNED",
  FINANCED: "FINANCED",
} as const;
export type OwnershipType = (typeof OwnershipType)[keyof typeof OwnershipType];

export const ODOMETER_MAX_KM = 2_000_000;

/** "hr-26 ev 4821" → "HR26EV4821". Stored and compared in this form; displayed with hyphens. */
export function normalizeRegistration(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Standard series (HR26EV4821, DL8CAB5678) and Bharat series (22BH1234AA). */
const REGISTRATION_PATTERNS = [/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/, /^\d{2}BH\d{4}[A-Z]{1,2}$/];

export function isValidRegistration(normalized: string): boolean {
  return REGISTRATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

// ---- field helpers: forms send "" for an empty input and "1,462" for a number typed with grouping.

const blankToNull = (value: unknown) =>
  (typeof value === "string" && value.trim() === "") ||
  (typeof value === "number" && Number.isNaN(value))
    ? null
    : value;

const numeric = (value: unknown) => {
  const cleaned = blankToNull(value);
  return typeof cleaned === "string" ? cleaned.replace(/[,\s]/g, "") : cleaned;
};

/** ISO date of tomorrow: "not in the future" tolerates the IST/UTC day boundary. */
const latestAllowedDate = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const optionalText = (max: number) =>
  z
    .preprocess(
      blankToNull,
      z.string().trim().max(max, `Use ${max} characters or fewer`).nullable(),
    )
    .optional();

const optionalInt = (min: number, max: number, message: string) =>
  z
    .preprocess(
      numeric,
      z.coerce.number<number>().int(message).min(min, message).max(max, message).nullable(),
    )
    .optional();

const requiredInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => numeric(value) ?? undefined,
    z.coerce.number<number>({ error: message }).int(message).min(min, message).max(max, message),
  );

const optionalDate = ({ pastOnly }: { pastOnly: boolean }) =>
  z
    .preprocess(
      blankToNull,
      z.iso
        .date("Enter a valid date")
        .refine((date) => !pastOnly || date <= latestAllowedDate(), "This date is in the future")
        .nullable(),
    )
    .optional();

const optionalCode = (pattern: RegExp, message: string) =>
  z
    .preprocess((value) => {
      const cleaned = blankToNull(value);
      return typeof cleaned === "string" ? cleaned.toUpperCase().replace(/\s/g, "") : cleaned;
    }, z.string().regex(pattern, message).nullable())
    .optional();

const currentYear = () => new Date().getFullYear();

export const createVehicleSchema = z.object({
  /** Optional client-generated id (CLAUDE.md: offline-sync ready); the API generates one otherwise. */
  id: z.uuid("Invalid id").optional(),

  // Step 1 · Basic details
  make: z.string().trim().min(1, "Choose the manufacturer").max(40, "Use 40 characters or fewer"),
  model: z.string().trim().min(1, "Enter the model").max(60, "Use 60 characters or fewer"),
  variant: optionalText(60),
  manufacturingYear: requiredInt(
    1950,
    currentYear() + 1,
    `Enter a year between 1950 and ${currentYear() + 1}`,
  ),
  category: z.enum(VehicleCategory, { error: "Choose a category" }),
  registrationNumber: z
    .string({ error: "Enter the registration number" })
    .transform(normalizeRegistration)
    .pipe(
      z
        .string()
        .min(1, "Enter the registration number")
        .refine(isValidRegistration, "Enter a valid registration number, e.g. HR-26-EV-4821"),
    ),

  // Step 2 · Specifications
  fuelType: z.enum(FuelType, { error: "Choose the fuel type" }),
  transmission: z.enum(Transmission, { error: "Choose the transmission" }),
  engineCapacityCc: optionalInt(50, 10_000, "Enter the displacement in cc, e.g. 1462"),
  engineConfiguration: optionalText(60),
  fuelTankCapacityL: optionalInt(1, 300, "Enter the tank capacity in litres, e.g. 45"),
  colour: optionalText(40),

  // Step 3 · Ownership
  ownershipType: z.enum(OwnershipType, { error: "Choose how you own it" }),
  purchaseDate: optionalDate({ pastOnly: true }),
  purchasePrice: z
    .preprocess(
      (value) => {
        const cleaned = numeric(value);
        return typeof cleaned === "number" ? String(cleaned) : cleaned;
      },
      z
        .string()
        .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter the price in rupees, e.g. 1145000")
        .nullable(),
    )
    .optional(),
  odometerKm: requiredInt(0, ODOMETER_MAX_KM, "Enter the odometer reading in km, e.g. 8450"),

  // Step 4 · Vehicle info (all optional)
  registrationDate: optionalDate({ pastOnly: true }),
  vin: optionalCode(/^[A-Z0-9]{6,25}$/, "Use 6–25 letters and digits"),
  engineNumber: optionalCode(/^[A-Z0-9-]{4,25}$/, "Use 4–25 letters, digits or hyphens"),
  fuelSpecification: optionalText(80),
  engineOilSpecification: optionalText(80),
  tyreSize: optionalText(40),
  batteryType: optionalText(60),
  warrantyExpiryDate: optionalDate({ pastOnly: false }),
  warrantyKmLimit: optionalInt(0, ODOMETER_MAX_KM, "Enter the warranty limit in km"),
  notes: optionalText(1000),
});

/** PATCH: every field optional; `null` clears an optional field, a missing key leaves it unchanged. */
export const updateVehicleSchema = createVehicleSchema.omit({ id: true }).partial();

export type CreateVehicleInput = z.input<typeof createVehicleSchema>;
export type CreateVehicleValues = z.output<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.input<typeof updateVehicleSchema>;
export type UpdateVehicleValues = z.output<typeof updateVehicleSchema>;

/** A vehicle as the API returns it. Dates are YYYY-MM-DD, money is a decimal string. */
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  manufacturingYear: number;
  category: VehicleCategory;
  /** Normalised: "HR26EV4821". */
  registrationNumber: string;
  registrationDate: string | null;
  fuelType: FuelType;
  transmission: Transmission;
  engineCapacityCc: number | null;
  engineConfiguration: string | null;
  fuelTankCapacityL: number | null;
  colour: string | null;
  ownershipType: OwnershipType;
  purchaseDate: string | null;
  purchasePrice: string | null;
  odometerKm: number;
  vin: string | null;
  engineNumber: string | null;
  fuelSpecification: string | null;
  engineOilSpecification: string | null;
  tyreSize: string | null;
  batteryType: string | null;
  warrantyExpiryDate: string | null;
  warrantyKmLimit: number | null;
  notes: string | null;
  /** 0–100: how much of the applicable profile is filled in (computed by the API). */
  profileCompletion: number;
  /** ISO timestamp when archived; null for vehicles in use. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
