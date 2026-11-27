import { describe, expect, it } from "vitest";

import { mergeNewest } from "./activity";

const item = (id: string, date: string, createdAt: string) => ({
  id,
  kind: "expense" as const,
  date,
  title: id,
  detail: null,
  amount: "1.00",
  odometerKm: null,
  href: `/x/${id}`,
  createdAt,
});

describe("mergeNewest", () => {
  const ids = (items: { id: string }[]) => items.map((entry) => entry.id);

  it("orders by day, then by when it was recorded, across sources", () => {
    const expenses = [
      item("toll", "2026-11-25", "2026-11-25T03:00:00.000Z"),
      item("fill", "2026-11-24", "2026-11-24T04:00:00.000Z"),
      item("old", "2026-10-02", "2026-11-26T10:00:00.000Z"), // back-logged: its day counts
    ];
    const services = [item("service", "2026-11-25", "2026-11-25T09:00:00.000Z")];
    expect(ids(mergeNewest(expenses, services))).toEqual(["service", "toll", "fill", "old"]);
  });

  it("keeps each source's own order, so a longer fetch only extends the pages", () => {
    // Maintenance lists same-day services by odometer, not by when they were recorded.
    const services = [
      item("s-8200km", "2026-11-18", "2026-11-18T05:00:00.000Z"),
      item("s-8100km", "2026-11-18", "2026-11-18T09:00:00.000Z"),
      item("s-older", "2026-11-02", "2026-11-02T09:00:00.000Z"),
    ];
    const expenses = [
      item("e-1", "2026-11-18", "2026-11-18T07:00:00.000Z"),
      item("e-2", "2026-11-10", "2026-11-10T07:00:00.000Z"),
      item("e-3", "2026-11-01", "2026-11-01T07:00:00.000Z"),
    ];
    const all = ids(mergeNewest(expenses, services));
    expect(all.indexOf("s-8200km")).toBeLessThan(all.indexOf("s-8100km"));
    // Page 1 of 2 (each source cut at 2) is the start of the whole feed.
    expect(ids(mergeNewest(expenses.slice(0, 2), services.slice(0, 2))).slice(0, 2)).toEqual(
      all.slice(0, 2),
    );
  });
});
