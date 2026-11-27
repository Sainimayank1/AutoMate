import {
  type CreateVehicleValues,
  FuelType,
  OwnershipType,
  Transmission,
  type Vehicle,
  type VehicleCategory,
} from "@automate/shared";

/**
 * Form state for the add wizard and the edit page: inputs hold strings, `createVehicleSchema`
 * (@automate/shared) turns them into the API payload ("" → null, "11,45,000" → "1145000").
 */
export type VehicleFormValues = {
  make: string;
  model: string;
  variant: string;
  manufacturingYear: string;
  category: VehicleCategory | "";
  registrationNumber: string;
  fuelType: FuelType;
  transmission: Transmission;
  engineCapacityCc: string;
  engineConfiguration: string;
  fuelTankCapacityL: string;
  colour: string;
  ownershipType: OwnershipType;
  purchaseDate: string;
  purchasePrice: string;
  odometerKm: string;
  registrationDate: string;
  vin: string;
  engineNumber: string;
  fuelSpecification: string;
  engineOilSpecification: string;
  tyreSize: string;
  batteryType: string;
  warrantyExpiryDate: string;
  warrantyKmLimit: string;
  notes: string;
};

/** Defaults follow the Stitch wizard: petrol, manual, owned outright. */
export const emptyVehicleForm: VehicleFormValues = {
  make: "",
  model: "",
  variant: "",
  manufacturingYear: "",
  category: "",
  registrationNumber: "",
  fuelType: FuelType.PETROL,
  transmission: Transmission.MANUAL,
  engineCapacityCc: "",
  engineConfiguration: "",
  fuelTankCapacityL: "",
  colour: "",
  ownershipType: OwnershipType.OWNED,
  purchaseDate: "",
  purchasePrice: "",
  odometerKm: "",
  registrationDate: "",
  vin: "",
  engineNumber: "",
  fuelSpecification: "",
  engineOilSpecification: "",
  tyreSize: "",
  batteryType: "",
  warrantyExpiryDate: "",
  warrantyKmLimit: "",
  notes: "",
};

export function toFormValues(vehicle: Vehicle): VehicleFormValues {
  const text = (value: string | number | null) => (value === null ? "" : String(value));
  return {
    ...emptyVehicleForm,
    ...Object.fromEntries(
      (Object.keys(emptyVehicleForm) as (keyof VehicleFormValues)[]).map((key) => [
        key,
        text(vehicle[key]),
      ]),
    ),
    category: vehicle.category,
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    ownershipType: vehicle.ownershipType,
    purchasePrice: vehicle.purchasePrice?.replace(/\.00$/, "") ?? "",
  };
}

const ENGINE_ONLY = ["engineCapacityCc", "fuelTankCapacityL", "engineOilSpecification"] as const;

/** Electric vehicles have no engine, tank or oil: drop anything typed before switching fuel. */
export function toVehiclePayload(values: CreateVehicleValues): CreateVehicleValues {
  if (values.fuelType !== FuelType.ELECTRIC) return values;
  return { ...values, ...Object.fromEntries(ENGINE_ONLY.map((key) => [key, null])) };
}

/** The four groups of the wizard (steps 1–4) and of the edit page (sections). */
export const VEHICLE_SECTIONS = [
  {
    id: "basic",
    title: "Basic details",
    description:
      "Tell us which car this is. Only the make, model, year, category and registration are required.",
    fields: ["make", "model", "variant", "manufacturingYear", "registrationNumber", "category"],
  },
  {
    id: "specifications",
    title: "Specifications",
    description: null,
    fields: [
      "fuelType",
      "transmission",
      "engineCapacityCc",
      "engineConfiguration",
      "fuelTankCapacityL",
      "colour",
    ],
  },
  {
    id: "ownership",
    title: "Ownership",
    description: null,
    fields: ["ownershipType", "purchaseDate", "purchasePrice", "odometerKm"],
  },
  {
    id: "info",
    title: "Vehicle info",
    description: "All optional. You can add these later; they raise your profile completion.",
    fields: [
      "registrationDate",
      "vin",
      "engineNumber",
      "fuelSpecification",
      "engineOilSpecification",
      "tyreSize",
      "batteryType",
      "warrantyExpiryDate",
      "warrantyKmLimit",
      "notes",
    ],
  },
] as const satisfies readonly {
  id: string;
  title: string;
  /** Shown under the wizard step's heading only (Stitch has none for steps 2 and 3). */
  description: string | null;
  fields: readonly (keyof VehicleFormValues)[];
}[];

export type VehicleSectionId = (typeof VEHICLE_SECTIONS)[number]["id"];

/** The section holding a field, so a server error can jump the wizard to the right step. */
export function sectionOf(field: string): number {
  const index = VEHICLE_SECTIONS.findIndex((section) =>
    (section.fields as readonly string[]).includes(field),
  );
  return Math.max(index, 0);
}
