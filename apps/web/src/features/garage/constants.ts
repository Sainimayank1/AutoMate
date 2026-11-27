import {
  FuelType,
  OwnershipType,
  Transmission,
  type Vehicle,
  VehicleCategory,
} from "@automate/shared";

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: "Petrol",
  [FuelType.DIESEL]: "Diesel",
  [FuelType.CNG]: "CNG",
  [FuelType.ELECTRIC]: "Electric",
  [FuelType.HYBRID]: "Hybrid",
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  [Transmission.MANUAL]: "Manual",
  [Transmission.AMT]: "AMT",
  [Transmission.IMT]: "iMT",
  [Transmission.CVT]: "CVT",
  [Transmission.DCT]: "DCT",
  [Transmission.AUTOMATIC]: "Automatic",
};

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  [VehicleCategory.HATCHBACK]: "Hatchback",
  [VehicleCategory.SEDAN]: "Sedan",
  [VehicleCategory.SUV]: "SUV",
  [VehicleCategory.MUV]: "MUV / MPV",
  [VehicleCategory.OTHER]: "Other",
};

export const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  [OwnershipType.OWNED]: "Owned",
  [OwnershipType.FINANCED]: "Financed",
};

/** Makes sold in India, for the manufacturer combobox. Free text is still allowed ("Other"). */
export const MANUFACTURERS = [
  "Maruti Suzuki",
  "Hyundai",
  "Tata Motors",
  "Mahindra",
  "Kia",
  "Toyota",
  "Honda",
  "MG",
  "Skoda",
  "Volkswagen",
  "Renault",
  "Nissan",
  "Citroën",
  "Jeep",
  "BYD",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volvo",
  "Lexus",
] as const;

/** "Maruti Suzuki Victoris" */
export const vehicleName = (vehicle: Pick<Vehicle, "make" | "model">) =>
  `${vehicle.make} ${vehicle.model}`;

/** "LXI · Petrol · Manual · 2025" (the parts that exist). */
export const vehicleSummary = (
  vehicle: Pick<Vehicle, "variant" | "fuelType" | "transmission" | "manufacturingYear">,
) =>
  [
    vehicle.variant,
    FUEL_TYPE_LABELS[vehicle.fuelType],
    TRANSMISSION_LABELS[vehicle.transmission],
    vehicle.manufacturingYear,
  ]
    .filter(Boolean)
    .join(" · ");
