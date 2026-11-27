import {
  type CreateServiceRecordValues,
  maintenanceGroupOf,
  REPAIR_RECORD_TYPES,
  ServiceRecordType,
  toPaise,
} from "@automate/shared";

import type { LinkedExpense } from "@/modules/expenses/linked-expenses.service";

type Category = Pick<LinkedExpense, "categoryKey" | "subcategoryKey">;
const maintenance = (sub: string | null): Category => ({
  categoryKey: "MAINTENANCE",
  subcategoryKey: sub && `MAINTENANCE.${sub}`,
});
const repairs = (sub: string): Category => ({
  categoryKey: "REPAIRS",
  subcategoryKey: `REPAIRS.${sub}`,
});

/** Maintenance work → its Maintenance & servicing subcategory (SYSTEM_EXPENSE_CATEGORIES). */
const MAINTENANCE_SUB: Record<string, string> = {
  "ENGINE.ENGINE_OIL": "ENGINE_OIL",
  "ENGINE.OIL_FILTER": "OIL_FILTER",
  "ENGINE.AIR_FILTER": "AIR_FILTER",
  "AC.CABIN_FILTER": "AC_FILTER",
  "TYRES.ALIGNMENT": "ALIGNMENT",
  "TYRES.BALANCING": "BALANCING",
  "ELECTRICAL.BATTERY_INSPECTION": "BATTERY",
  "ELECTRICAL.BATTERY_REPLACEMENT": "BATTERY",
};
const GROUP_SUB: Record<string, string> = { BRAKES: "BRAKES", TYRES: "TYRES", COOLING: "COOLANT" };

/** Repair work → its Repairs subcategory. */
const REPAIR_SUB: Record<string, string> = {
  "REPAIRS.ENGINE": "ENGINE",
  "REPAIRS.ELECTRICAL": "ELECTRICAL",
  "REPAIRS.ACCIDENT": "ACCIDENT",
  "REPAIRS.BODYWORK": "BODYWORK",
  "TRANSMISSION.CLUTCH_REPLACEMENT": "CLUTCH",
  "BODY.PAINT": "BODYWORK",
};
const REPAIR_GROUP_SUB: Record<string, string> = {
  ENGINE: "ENGINE",
  TRANSMISSION: "CLUTCH",
  SUSPENSION: "SUSPENSION",
  ELECTRICAL: "ELECTRICAL",
  AC: "AC",
  BODY: "BODYWORK",
};

/**
 * Where a record's money goes in Expenses. Repair types (and repair work) go to Repairs; upgrades
 * to Accessories (a capital cost, not running cost); cleaning to Washing & detailing; the rest to
 * Maintenance & servicing, by what was done.
 */
export function expenseCategoryOf(type: ServiceRecordType, categoryKey: string): Category {
  const group = maintenanceGroupOf(categoryKey);
  if (type === ServiceRecordType.MODIFICATION) {
    return { categoryKey: "ACCESSORIES", subcategoryKey: "ACCESSORIES.MODIFICATIONS" };
  }
  if (REPAIR_RECORD_TYPES.includes(type) || group === "REPAIRS" || REPAIR_SUB[categoryKey]) {
    return repairs(REPAIR_SUB[categoryKey] ?? REPAIR_GROUP_SUB[group] ?? "OTHER");
  }
  if (group === "BODY")
    return { categoryKey: "DAILY_USAGE", subcategoryKey: "DAILY_USAGE.WASHING" };
  if (group === "SUSPENSION" && categoryKey !== "SUSPENSION.INSPECTION") {
    return repairs("SUSPENSION");
  }
  if (group === "OTHER") return maintenance(null);
  return maintenance(MAINTENANCE_SUB[categoryKey] ?? GROUP_SUB[group] ?? "GENERAL_SERVICE");
}

const TYPE_LABELS: Record<ServiceRecordType, string> = {
  ROUTINE_SERVICE: "Routine service",
  PREVENTIVE: "Preventive maintenance",
  INSPECTION: "Inspection",
  REPAIR: "Repair",
  COMPONENT_REPLACEMENT: "Component replacement",
  EMERGENCY_REPAIR: "Emergency repair",
  WARRANTY_REPAIR: "Warranty repair",
  MODIFICATION: "Modification / upgrade",
  OTHER: "Other",
};

/** A service record as the money it represents (one linked expense, source MAINTENANCE). */
export function toMaintenanceExpense(
  record: CreateServiceRecordValues & { id: string; userId: string; vehicleId: string },
  total: string,
  provider: string | null,
): LinkedExpense {
  const parts = record.partsAmount ?? null;
  const labour = record.labourAmount ?? null;
  // The expense keeps parts and labour only when they fit in what was paid (discounts can push
  // their sum above it, and the expenses table checks parts + labour ≤ amount).
  const fits = toPaise(parts ?? "0") + toPaise(labour ?? "0") <= toPaise(total);
  const items = (record.items ?? []).map((item) => item.name);
  return {
    userId: record.userId,
    vehicleId: record.vehicleId,
    source: "MAINTENANCE",
    sourceId: record.id,
    ...expenseCategoryOf(record.type, record.categoryKey),
    title: record.title,
    amount: total,
    date: record.serviceDate,
    paymentMethod: record.paymentMethod ?? null,
    vendor: provider,
    odometerKm: record.odometerKm ?? null,
    description: record.description ?? null,
    notes: record.notes ?? null,
    service: {
      serviceType: TYPE_LABELS[record.type],
      partsReplaced: items.length ? items.join(", ") : null,
      partsAmount: fits ? parts : null,
      labourAmount: fits ? labour : null,
      warrantyUntil: record.warrantyUntil ?? null,
      provider,
    },
  };
}
