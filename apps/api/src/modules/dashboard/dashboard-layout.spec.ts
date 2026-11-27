import {
  dashboardLayoutSchema,
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
} from "@automate/shared";
import { describe, expect, it } from "vitest";

const ids = (layout: { widgets: { id: string }[] }) => layout.widgets.map((widget) => widget.id);

describe("normalizeDashboardLayout", () => {
  it("is the default with nothing saved", () => {
    expect(normalizeDashboardLayout(null)).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(normalizeDashboardLayout("junk")).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it("keeps the saved order and visibility, and the key figures in their fixed order", () => {
    const saved = {
      widgets: [...DEFAULT_DASHBOARD_LAYOUT.widgets].reverse().map((widget) => ({
        ...widget,
        visible: widget.id !== "fuel",
      })),
      metrics: ["fuelSpend", "spent"],
    };
    const layout = normalizeDashboardLayout(saved);
    expect(ids(layout)).toEqual(ids(DEFAULT_DASHBOARD_LAYOUT).reverse());
    expect(layout.widgets.find((widget) => widget.id === "fuel")).toEqual({
      id: "fuel",
      visible: false,
    });
    expect(layout.metrics).toEqual(["spent", "fuelSpend"]);
  });

  it("drops sections that went away and adds new ones where the default has them", () => {
    // Saved before "insights" existed, with a section since removed.
    const saved = {
      widgets: [
        { id: "activity", visible: true },
        { id: "metrics", visible: false },
        { id: "gone", visible: true },
        { id: "spending", visible: true },
        { id: "fuel", visible: true },
        { id: "maintenance", visible: true },
        { id: "expiries", visible: true },
        { id: "driving", visible: true },
        { id: "metrics", visible: true },
      ],
      metrics: ["nope"],
    };
    const layout = normalizeDashboardLayout(saved);
    expect(ids(layout)).toEqual([
      "activity",
      "metrics",
      "insights",
      "spending",
      "fuel",
      "maintenance",
      "expiries",
      "driving",
    ]);
    expect(layout.widgets[1]).toEqual({ id: "metrics", visible: false });
    expect(layout.widgets[2]).toEqual({ id: "insights", visible: true });
    expect(layout.metrics).toEqual(DEFAULT_DASHBOARD_LAYOUT.metrics);
    expect(dashboardLayoutSchema.safeParse(layout).success).toBe(true);
  });
});

describe("dashboardLayoutSchema", () => {
  it("needs every section once and at least one key figure", () => {
    const { widgets } = DEFAULT_DASHBOARD_LAYOUT;
    expect(dashboardLayoutSchema.safeParse(DEFAULT_DASHBOARD_LAYOUT).success).toBe(true);
    for (const layout of [
      { widgets: widgets.slice(1), metrics: ["spent"] },
      { widgets: [...widgets.slice(1), widgets[1]], metrics: ["spent"] },
      { widgets, metrics: [] },
      { widgets, metrics: ["spent", "spent"] },
    ]) {
      expect(dashboardLayoutSchema.safeParse(layout).success).toBe(false);
    }
  });
});
