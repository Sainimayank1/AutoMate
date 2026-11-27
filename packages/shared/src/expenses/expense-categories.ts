/**
 * Expense categories (Expenses, module 4): the cost classes that drive the money views, the icon
 * set custom categories choose from, and the system category tree the API seeds.
 */

/** Which money views a category counts in (docs/architecture/expenses.md). */
export const CostClass = {
  /** Running the vehicle: fuel, servicing, repairs, tolls, parking, washing. In cost per km. */
  OPERATING: "OPERATING",
  /** Owning it whether or not it moves: insurance, taxes, registration, PUC, fines. */
  OWNERSHIP: "OWNERSHIP",
  /** Loans: interest and charges are costs; principal only reduces the loan. */
  FINANCING: "FINANCING",
  /** Things added to the vehicle: accessories, upgrades. Paid and owned, not running cost. */
  CAPITAL: "CAPITAL",
} as const;
export type CostClass = (typeof CostClass)[keyof typeof CostClass];

/** Lucide icon names a category may use (the web maps them to components). */
export const EXPENSE_ICONS = [
  "fuel",
  "wrench",
  "hammer",
  "shield-check",
  "landmark",
  "route",
  "sparkles",
  "package",
  "circle-dot",
  "battery",
  "car",
  "car-front",
  "parking-meter",
  "droplets",
  "receipt",
  "credit-card",
  "file-text",
  "life-buoy",
  "lightbulb",
  "music",
  "camera",
  "armchair",
  "paint-roller",
  "badge-indian-rupee",
] as const;
export type ExpenseIcon = (typeof EXPENSE_ICONS)[number];

/** How a loan payment's amount is split, preset by its Finance subcategory. */
export type FinanceComponent = "SPLIT" | "PRINCIPAL" | "INTEREST" | "CHARGES";

export interface SystemCategory {
  /** Stable across environments; code refers to categories by key, never by id. */
  key: string;
  name: string;
  icon: ExpenseIcon;
  costClass: CostClass;
  subcategories: { key: string; name: string; finance?: FinanceComponent }[];
}

/** Fuel expenses are created by Fuel entries, never by hand. */
export const FUEL_CATEGORY_KEY = "FUEL";

const sub = (parent: string, entries: [string, string, FinanceComponent?][]) =>
  entries.map(([key, name, finance]) => ({
    key: `${parent}.${key}`,
    name,
    ...(finance && { finance }),
  }));

export const SYSTEM_EXPENSE_CATEGORIES: SystemCategory[] = [
  {
    key: FUEL_CATEGORY_KEY,
    name: "Fuel",
    icon: "fuel",
    costClass: CostClass.OPERATING,
    subcategories: sub("FUEL", [
      ["PETROL", "Petrol"],
      ["DIESEL", "Diesel"],
      ["CNG", "CNG"],
      ["EV_CHARGING", "EV charging"],
    ]),
  },
  {
    key: "MAINTENANCE",
    name: "Maintenance & servicing",
    icon: "wrench",
    costClass: CostClass.OPERATING,
    subcategories: sub("MAINTENANCE", [
      ["GENERAL_SERVICE", "General servicing"],
      ["ENGINE_OIL", "Engine oil"],
      ["OIL_FILTER", "Oil filter"],
      ["AIR_FILTER", "Air filter"],
      ["AC_FILTER", "AC filter"],
      ["BRAKES", "Brake service"],
      ["COOLANT", "Coolant"],
      ["BATTERY", "Battery"],
      ["TYRES", "Tyres"],
      ["ALIGNMENT", "Wheel alignment"],
      ["BALANCING", "Wheel balancing"],
    ]),
  },
  {
    key: "REPAIRS",
    name: "Repairs",
    icon: "hammer",
    costClass: CostClass.OPERATING,
    subcategories: sub("REPAIRS", [
      ["ENGINE", "Engine repair"],
      ["CLUTCH", "Clutch repair"],
      ["SUSPENSION", "Suspension"],
      ["ELECTRICAL", "Electrical repair"],
      ["AC", "AC repair"],
      ["BODYWORK", "Bodywork"],
      ["ACCIDENT", "Accident repair"],
      ["OTHER", "Other repairs"],
    ]),
  },
  {
    key: "INSURANCE_LEGAL",
    name: "Insurance & legal",
    icon: "shield-check",
    costClass: CostClass.OWNERSHIP,
    subcategories: sub("INSURANCE_LEGAL", [
      ["COMPREHENSIVE", "Comprehensive insurance"],
      ["THIRD_PARTY", "Third-party insurance"],
      ["OTHER_INSURANCE", "Other insurance"],
      ["PUC", "PUC"],
      ["REGISTRATION", "Registration"],
      ["ROAD_TAX", "Road tax"],
      ["FINES", "Challans & fines"],
      ["PERMITS", "Permits"],
    ]),
  },
  {
    key: "FINANCE",
    name: "Finance",
    icon: "landmark",
    costClass: CostClass.FINANCING,
    subcategories: sub("FINANCE", [
      ["EMI", "Vehicle EMI", "SPLIT"],
      ["INTEREST", "Loan interest", "INTEREST"],
      ["PROCESSING_FEE", "Loan processing fee", "CHARGES"],
      ["PREPAYMENT_CHARGES", "Prepayment charges", "CHARGES"],
      ["PART_PREPAYMENT", "Part-prepayment (principal)", "PRINCIPAL"],
    ]),
  },
  {
    key: "DAILY_USAGE",
    name: "Daily usage",
    icon: "route",
    costClass: CostClass.OPERATING,
    subcategories: sub("DAILY_USAGE", [
      ["TOLL", "Toll"],
      ["PARKING", "Parking"],
      ["WASHING", "Washing & detailing"],
      ["FASTAG", "FASTag"],
      ["ROADSIDE", "Roadside assistance"],
    ]),
  },
  {
    key: "ACCESSORIES",
    name: "Accessories & upgrades",
    icon: "package",
    costClass: CostClass.CAPITAL,
    subcategories: sub("ACCESSORIES", [
      ["SEAT_COVERS", "Seat covers"],
      ["INFOTAINMENT", "Infotainment"],
      ["DASHCAM", "Dashcam"],
      ["SPEAKERS", "Speakers"],
      ["LIGHTING", "Lighting"],
      ["MODIFICATIONS", "Modifications"],
      ["OTHER", "Other accessories"],
    ]),
  },
  {
    key: "OTHER",
    name: "Other",
    icon: "circle-dot",
    costClass: CostClass.OPERATING,
    subcategories: sub("OTHER", [
      ["MISC", "Miscellaneous"],
      ["EMERGENCY", "Emergency expenses"],
    ]),
  },
];

/** The preset split of a system Finance subcategory, by key. */
export const FINANCE_COMPONENT_BY_KEY: Record<string, FinanceComponent> = Object.fromEntries(
  SYSTEM_EXPENSE_CATEGORIES.flatMap((category) =>
    category.subcategories.flatMap((item) => (item.finance ? [[item.key, item.finance]] : [])),
  ),
);
