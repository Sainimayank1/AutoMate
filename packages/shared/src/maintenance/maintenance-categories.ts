/**
 * What maintenance can be about (module 5). Keys are "GROUP.ITEM", stored on schedules and records;
 * names are display text. Work that fits none is a free-text title under OTHER.OTHER.
 * No intervals here: every interval is the user's (docs/architecture/maintenance.md §1).
 */
export const MAINTENANCE_GROUPS = [
  {
    key: "ENGINE",
    name: "Engine",
    items: [
      ["ENGINE_OIL", "Engine oil"],
      ["OIL_FILTER", "Oil filter"],
      ["AIR_FILTER", "Air filter"],
      ["SPARK_PLUGS", "Spark plugs"],
      ["IGNITION_COILS", "Ignition coils"],
      ["TIMING_BELT", "Timing belt"],
      ["TIMING_CHAIN", "Timing chain inspection"],
      ["DIAGNOSTICS", "Engine diagnostics"],
    ],
  },
  {
    key: "TRANSMISSION",
    name: "Transmission",
    items: [
      ["GEARBOX_OIL", "Gearbox oil"],
      ["CLUTCH_INSPECTION", "Clutch inspection"],
      ["CLUTCH_REPLACEMENT", "Clutch replacement"],
      ["INSPECTION", "Transmission inspection"],
    ],
  },
  {
    key: "BRAKES",
    name: "Brakes",
    items: [
      ["BRAKE_PADS", "Brake pads"],
      ["BRAKE_DISCS", "Brake discs"],
      ["BRAKE_FLUID", "Brake fluid"],
      ["INSPECTION", "Brake inspection"],
      ["HANDBRAKE", "Handbrake"],
    ],
  },
  {
    key: "TYRES",
    name: "Tyres & wheels",
    items: [
      ["ROTATION", "Tyre rotation"],
      ["REPLACEMENT", "Tyre replacement"],
      ["ALIGNMENT", "Wheel alignment"],
      ["BALANCING", "Wheel balancing"],
      ["PRESSURE", "Tyre pressure check"],
      ["PUNCTURE", "Puncture repair"],
    ],
  },
  {
    key: "ELECTRICAL",
    name: "Electrical",
    items: [
      ["BATTERY_INSPECTION", "Battery inspection"],
      ["BATTERY_REPLACEMENT", "Battery replacement"],
      ["ALTERNATOR", "Alternator"],
      ["STARTER", "Starter motor"],
      ["WIRING", "Wiring inspection"],
    ],
  },
  {
    key: "COOLING",
    name: "Cooling",
    items: [
      ["COOLANT", "Coolant replacement"],
      ["RADIATOR", "Radiator inspection"],
      ["FLUSH", "Cooling system flush"],
      ["HOSES", "Hose inspection"],
    ],
  },
  {
    key: "AC",
    name: "AC & climate",
    items: [
      ["SERVICE", "AC service"],
      ["REFRIGERANT", "Refrigerant"],
      ["CABIN_FILTER", "Cabin filter"],
      ["DIAGNOSTICS", "AC diagnostics"],
    ],
  },
  {
    key: "SUSPENSION",
    name: "Suspension & steering",
    items: [
      ["INSPECTION", "Suspension inspection"],
      ["SHOCK_ABSORBERS", "Shock absorbers"],
      ["STEERING", "Steering system"],
      ["BUSHES", "Bushes"],
      ["WHEEL_BEARINGS", "Wheel bearings"],
    ],
  },
  {
    key: "GENERAL",
    name: "General service",
    items: [
      ["PERIODIC_SERVICE", "Periodic service"],
      ["COMPREHENSIVE_SERVICE", "Comprehensive service"],
      ["PREVENTIVE", "Preventive maintenance"],
      ["INSPECTION", "Vehicle inspection"],
    ],
  },
  {
    key: "BODY",
    name: "Exterior & interior",
    items: [
      ["CLEANING", "Cleaning"],
      ["DETAILING", "Detailing"],
      ["PAINT", "Paint repair"],
      ["INTERIOR", "Interior treatment"],
    ],
  },
  {
    key: "REPAIRS",
    name: "Repairs",
    items: [
      ["ENGINE", "Engine repair"],
      ["ELECTRICAL", "Electrical repair"],
      ["ACCIDENT", "Accident repair"],
      ["BODYWORK", "Bodywork"],
      ["EMERGENCY", "Emergency repair"],
      ["OTHER", "Other repair"],
    ],
  },
  { key: "OTHER", name: "Other", items: [["OTHER", "Other"]] },
] as const satisfies readonly {
  key: string;
  name: string;
  items: readonly (readonly [string, string])[];
}[];

type Group = (typeof MAINTENANCE_GROUPS)[number];
export type MaintenanceGroupKey = Group["key"];
export type MaintenanceCategoryKey = {
  [G in Group as G["key"]]: `${G["key"]}.${G["items"][number][0]}`;
}[MaintenanceGroupKey];

export const MAINTENANCE_CATEGORY_KEYS = MAINTENANCE_GROUPS.flatMap((group) =>
  group.items.map(([item]) => `${group.key}.${item}`),
) as [MaintenanceCategoryKey, ...MaintenanceCategoryKey[]];

const names = new Map<string, string>(
  MAINTENANCE_GROUPS.flatMap((group) =>
    group.items.map(([item, name]) => [`${group.key}.${item}`, name] as const),
  ),
);

/** "BRAKES.BRAKE_PADS" → "Brake pads". */
export const maintenanceCategoryName = (key: string) => names.get(key) ?? "Other";

/** "BRAKES.BRAKE_PADS" → "BRAKES". */
export const maintenanceGroupOf = (key: string) => key.split(".")[0] as MaintenanceGroupKey;
