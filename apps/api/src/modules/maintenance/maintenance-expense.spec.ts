import { breakdownTotal, serviceRecordTotal } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { expenseCategoryOf, toMaintenanceExpense } from "./maintenance-expense";

describe("expenseCategoryOf", () => {
  it.each([
    ["ROUTINE_SERVICE", "ENGINE.ENGINE_OIL", "MAINTENANCE", "MAINTENANCE.ENGINE_OIL"],
    ["ROUTINE_SERVICE", "GENERAL.PERIODIC_SERVICE", "MAINTENANCE", "MAINTENANCE.GENERAL_SERVICE"],
    ["COMPONENT_REPLACEMENT", "BRAKES.BRAKE_PADS", "MAINTENANCE", "MAINTENANCE.BRAKES"],
    [
      "COMPONENT_REPLACEMENT",
      "ELECTRICAL.BATTERY_REPLACEMENT",
      "MAINTENANCE",
      "MAINTENANCE.BATTERY",
    ],
    ["INSPECTION", "TYRES.ALIGNMENT", "MAINTENANCE", "MAINTENANCE.ALIGNMENT"],
    ["REPAIR", "ENGINE.TIMING_BELT", "REPAIRS", "REPAIRS.ENGINE"],
    ["EMERGENCY_REPAIR", "BRAKES.BRAKE_DISCS", "REPAIRS", "REPAIRS.OTHER"],
    ["ROUTINE_SERVICE", "REPAIRS.ACCIDENT", "REPAIRS", "REPAIRS.ACCIDENT"],
    ["COMPONENT_REPLACEMENT", "TRANSMISSION.CLUTCH_REPLACEMENT", "REPAIRS", "REPAIRS.CLUTCH"],
    ["ROUTINE_SERVICE", "BODY.DETAILING", "DAILY_USAGE", "DAILY_USAGE.WASHING"],
    ["MODIFICATION", "ELECTRICAL.WIRING", "ACCESSORIES", "ACCESSORIES.MODIFICATIONS"],
    ["OTHER", "OTHER.OTHER", "MAINTENANCE", null],
  ] as const)("%s · %s → %s / %s", (type, categoryKey, category, subcategory) => {
    expect(expenseCategoryOf(type, categoryKey)).toEqual({
      categoryKey: category,
      subcategoryKey: subcategory,
    });
  });
});

describe("service record totals", () => {
  it("adds the breakdown in exact paise, less the discount", () => {
    const values = {
      labourAmount: "1200.10",
      partsAmount: "4800.20",
      otherAmount: "0.10",
      taxAmount: "1350",
      discountAmount: "500.40",
    };
    expect(breakdownTotal(values)).toBe(685_000);
    expect(serviceRecordTotal(values)).toBe("6850.00");
  });

  it("uses the entered total without a breakdown, and zero when nothing was paid", () => {
    expect(serviceRecordTotal({ totalAmount: "6850.5" })).toBe("6850.50");
    expect(serviceRecordTotal({})).toBe("0.00");
  });
});

describe("toMaintenanceExpense", () => {
  const record = {
    id: "0190d4a2-0000-7000-8000-00000000d001",
    userId: "u",
    vehicleId: "v",
    type: "ROUTINE_SERVICE" as const,
    title: "2nd free periodic service",
    categoryKey: "GENERAL.PERIODIC_SERVICE" as const,
    serviceDate: "2026-05-18",
    odometerKm: 5120,
    partsAmount: "4800.00",
    labourAmount: "1200.00",
    discountAmount: "1500.00",
    items: [{ name: "Engine oil 0W-20" }, { name: "Oil filter" }],
  };

  it("maps the record and keeps parts and labour only when they fit in the amount", () => {
    const expense = toMaintenanceExpense(record, "4500.00", "Maruti Arena Service");
    expect(expense).toMatchObject({
      source: "MAINTENANCE",
      sourceId: record.id,
      categoryKey: "MAINTENANCE",
      subcategoryKey: "MAINTENANCE.GENERAL_SERVICE",
      title: "2nd free periodic service",
      amount: "4500.00",
      date: "2026-05-18",
      vendor: "Maruti Arena Service",
      odometerKm: 5120,
      service: {
        serviceType: "Routine service",
        partsReplaced: "Engine oil 0W-20, Oil filter",
        // ₹4,800 + ₹1,200 is more than the ₹4,500 paid after the discount.
        partsAmount: null,
        labourAmount: null,
      },
    });
    expect(toMaintenanceExpense(record, "6000.00", null).service).toMatchObject({
      partsAmount: "4800.00",
      labourAmount: "1200.00",
    });
  });
});
