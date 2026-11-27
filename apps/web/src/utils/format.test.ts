import { describe, expect, it } from "vitest";

import {
  EMPTY_VALUE,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDistance,
  formatEfficiency,
  formatNumber,
  formatRegistration,
  formatVolume,
} from "@/utils/format";

describe("Indian formatters", () => {
  it("formats rupees with lakh grouping", () => {
    expect(formatCurrency(125000)).toBe("₹1,25,000.00");
    expect(formatCurrency(12345678.9)).toBe("₹1,23,45,678.90");
    expect(formatCurrency(0)).toBe("₹0.00");
  });

  it("formats decimal strings exactly, without float rounding", () => {
    expect(formatCurrency("125000.10")).toBe("₹1,25,000.10");
    expect(formatCurrency("0.105")).toBe("₹0.11");
  });

  it("formats numbers and units", () => {
    expect(formatNumber(1250000)).toBe("12,50,000");
    expect(formatDistance(12500)).toBe("12,500 km");
    expect(formatVolume("35.42")).toBe("35.42 L");
    expect(formatEfficiency(15.5)).toBe("15.5 km/L");
    expect(formatEfficiency(15)).toBe("15.0 km/L");
  });

  it("formats dates as DD/MM/YYYY", () => {
    expect(formatDate(new Date(2026, 10, 27))).toBe("27/11/2026");
    expect(formatDate("2026-01-05T10:00:00")).toBe("05/01/2026");
    expect(formatDateTime(new Date(2026, 10, 27, 9, 30))).toBe("27/11/2026, 9:30 AM");
  });

  it("shows a dash for missing or invalid values instead of crashing", () => {
    for (const value of [null, undefined, "", "abc", Number.NaN]) {
      expect(formatCurrency(value)).toBe(EMPTY_VALUE);
      expect(formatDistance(value)).toBe(EMPTY_VALUE);
    }
    expect(formatDate("not a date")).toBe(EMPTY_VALUE);
    expect(formatDate(null)).toBe(EMPTY_VALUE);
  });
});

describe("formatRegistration", () => {
  it("formats Indian plates with hyphens", () => {
    expect(formatRegistration("HR26EV4821")).toBe("HR-26-EV-4821");
    expect(formatRegistration("DL8CAB5678")).toBe("DL-8-CAB-5678");
    expect(formatRegistration("MH124821")).toBe("MH-12-4821");
    expect(formatRegistration("22BH1234AA")).toBe("22-BH-1234-AA");
    expect(formatRegistration("hr 26 ev 4821")).toBe("HR-26-EV-4821");
  });

  it("passes unknown formats through and shows a dash for none", () => {
    expect(formatRegistration("CD123ABC45")).toBe("CD123ABC45");
    expect(formatRegistration(null)).toBe(EMPTY_VALUE);
  });
});
