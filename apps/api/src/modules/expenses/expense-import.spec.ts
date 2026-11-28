import { parseCsv } from "@automate/shared";
import { describe, expect, it } from "vitest";

import { isLinkedSource, parseAmount, parseDate, parsePayment, readRows } from "./expense-import";

describe("parseCsv", () => {
  it("reads quoted cells with commas, quotes and line breaks, and drops a BOM", () => {
    expect(
      parseCsv('﻿Date,Title\r\n2026-11-21,"Toll, NH-48"\r\n2026-11-22,"Say ""hi""\nthere"\r\n\r\n'),
    ).toEqual([
      ["Date", "Title"],
      ["2026-11-21", "Toll, NH-48"],
      ["2026-11-22", 'Say "hi"\nthere'],
    ]);
  });
});

describe("readRows", () => {
  it("maps the export's columns in any order, from line 2", () => {
    const rows = readRows([
      ["Title", "Amount (INR)", "Date", "Category", "Vehicle", "Source"],
      ["NH-48 FASTag", "640.00", "2026-11-21", "Daily usage", "Victoris", "Manual"],
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        line: 2,
        title: "NH-48 FASTag",
        amount: "640.00",
        date: "2026-11-21",
        category: "Daily usage",
        source: "Manual",
        subcategory: "",
      }),
    ]);
  });

  it("names the columns it needs", () => {
    expect(readRows([["Date", "Title"]])).toEqual({ missing: ["category", "amount (inr)"] });
  });
});

describe("cells", () => {
  it("reads ISO and day-first dates, and refuses impossible ones", () => {
    expect(parseDate("2026-11-21")).toBe("2026-11-21");
    expect(parseDate("21/11/2026")).toBe("2026-11-21");
    expect(parseDate("1-2-2026")).toBe("2026-02-01");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Nov 21")).toBeNull();
  });

  it("reads rupee amounts, and knows a refund", () => {
    expect(parseAmount("₹1,500.00")).toEqual({ amount: "1500.00" });
    expect(parseAmount("640")).toEqual({ amount: "640" });
    expect(parseAmount("-140.00")).toBe("refund");
    expect(parseAmount("12.345")).toBeNull();
  });

  it("matches payment methods by value or label", () => {
    expect(parsePayment("Net banking")).toBe("NET_BANKING");
    expect(parsePayment("upi")).toBe("UPI");
    expect(parsePayment("")).toBeNull();
    expect(parsePayment("Cheque")).toBe("unknown");
  });

  it("knows rows that came from another module", () => {
    expect(isLinkedSource("Fuel")).toBe(true);
    expect(isLinkedSource("Manual")).toBe(false);
    expect(isLinkedSource("")).toBe(false);
  });
});
