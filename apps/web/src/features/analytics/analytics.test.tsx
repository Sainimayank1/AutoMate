import type { AnalyticsOverview, OwnershipCost } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const window = { from: "2026-01-01", to: "2026-11-28" };
const groups = (fuel: string) => ({
  fuel,
  maintenance: "0.00",
  insurance: "0.00",
  loan: "0.00",
  other: "0.00",
});
const ownership = (overrides: Partial<OwnershipCost>): OwnershipCost => ({
  period: "this_year",
  window,
  operating: "23638.79",
  ownership: "15400.00",
  financingCharges: "0.00",
  capital: "0.00",
  depreciation: null,
  economic: "39038.79",
  cashOutflow: "39038.79",
  principal: "0.00",
  distanceKm: 2642,
  economicPerKm: "14.78",
  months: "10.9",
  perMonth: "3581.54",
  ...overrides,
});
const overview: AnalyticsOverview = {
  period: "this_year",
  window,
  totals: {
    spent: "39038.79",
    economic: "138148.69",
    cashOutflow: "39038.79",
    principal: "0.00",
    depreciation: "99109.90",
    estimatedValue: "936610.00",
    distanceKm: 2642,
    costPerKm: "52.29",
    perMonth: "12674.19",
    mileage: { value: "17.00", unit: "km/L", cycles: 5 },
  },
  spending: {
    total: "39038.79",
    categories: [
      {
        category: { id: "c1", key: "FUEL", name: "Fuel", icon: "fuel", costClass: "OPERATING" },
        amount: "19638.79",
        percent: 50.3,
      },
    ],
    months: [{ month: "2026-11", total: "6718.21", groups: groups("6718.21") }],
  },
  vehicles: [
    {
      vehicleId: victoris.id,
      name: "Maruti Suzuki Victoris LXI",
      registrationNumber: "HR26EV4821",
      fuelType: "PETROL",
      odometerKm: 8412,
      ownership: ownership({ economic: "138148.69", economicPerKm: "52.29" }),
      mileage: { value: "17.00", unit: "km/L", cycles: 5 },
      serviceSpend: "2650.00",
    },
  ],
};

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("analytics", () => {
  it("shows the fleet's totals, its spending and every vehicle side by side", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /analytics/overview": () => ok(overview),
    });
    renderApp("/analytics");
    const user = userEvent.setup();

    const totals = within(await screen.findByRole("region", { name: "Totals" }));
    expect(totals.getByText("₹52.29")).toBeInTheDocument();
    expect(totals.getByText("Over 2,642 km, depreciation included")).toBeInTheDocument();
    expect(totals.getByText("17.0 km/L")).toBeInTheDocument();
    expect(totals.getByText("₹9,36,610.00")).toBeInTheDocument();
    expect(screen.getByText("Monthly spending")).toBeInTheDocument();

    const table = within(screen.getByRole("table"));
    expect(table.getByRole("link", { name: "Maruti Suzuki Victoris LXI" })).toHaveAttribute(
      "href",
      `/expenses/ownership?vehicle=${victoris.id}&period=this_year`,
    );
    expect(table.getByText("₹2,650.00")).toBeInTheDocument();
    expect(table.getByText("₹1,38,148.69")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export report" })).toHaveAttribute(
      "href",
      `/expenses/report?vehicle=${victoris.id}&period=this_year`,
    );

    await user.click(screen.getByRole("radio", { name: "Lifetime" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/analytics/overview").at(-1)?.params).toEqual({
        period: "all_time",
      }),
    );
  });

  it("invites the first vehicle", async () => {
    api({
      "GET /vehicles": () => okPage([]),
      "GET /analytics/overview": () => ok({ ...overview, vehicles: [] }),
    });
    renderApp("/analytics");
    expect(await screen.findByText("No vehicles yet")).toBeInTheDocument();
  });
});
