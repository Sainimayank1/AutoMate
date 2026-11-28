import type { OwnershipCost } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const cost = (overrides: Partial<OwnershipCost> = {}): OwnershipCost => ({
  period: "this_year",
  window: { from: "2026-01-01", to: "2026-11-28" },
  operating: "23638.79",
  ownership: "15400.00",
  financingCharges: "4478.00",
  capital: "6500.00",
  depreciation: {
    amount: "99109.90",
    purchasePrice: "1145000.00",
    purchaseDate: "2025-04-10",
    ageMonths: 19,
    percent: "18.2",
    estimatedValue: "936610.00",
    beyondSchedule: false,
  },
  economic: "149126.69",
  cashOutflow: "51667.79",
  principal: "12129.00",
  distanceKm: 2642,
  economicPerKm: "56.44",
  months: "10.9",
  perMonth: "13681.35",
  ...overrides,
});

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

describe("ownership cost", () => {
  it("shows the three money views, where the cost goes, rates and depreciation", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /expenses/ownership": (config) =>
        ok(
          cost(
            (config.params as { period: string }).period === "all_time"
              ? { period: "all_time", economic: "300000.00" }
              : {},
          ),
        ),
    });
    renderApp("/expenses/ownership");
    const user = userEvent.setup();

    const views = within(
      (await screen.findByRole("heading", { name: "Three ways to count it" })).closest(
        "[data-slot=card]",
      )!,
    );
    expect(views.getByText("₹23,638.79")).toBeInTheDocument();
    expect(views.getByText("₹51,667.79")).toBeInTheDocument();
    expect(views.getByText(/₹12,129.00 of loan principal/)).toBeInTheDocument();
    expect(views.getAllByText("₹1,49,126.69").length).toBeGreaterThan(0);
    expect(calls.find((call) => call.url === "/expenses/ownership")?.params).toEqual({
      vehicleId: victoris.id,
      period: "this_year",
    });

    const breakdown = within(
      screen
        .getByRole("heading", { name: "Where the economic cost goes" })
        .closest("[data-slot=card]")!,
    );
    expect(
      breakdown.getByRole("progressbar", { name: "Depreciation (estimate): ₹99,109.90" }),
    ).toBeInTheDocument();
    expect(breakdown.getByText("₹4,478.00")).toBeInTheDocument();
    expect(screen.getByText("₹56.44")).toBeInTheDocument();
    expect(screen.getByText("Over 2,642 km")).toBeInTheDocument();
    expect(screen.getByText("Average over 10.9 months")).toBeInTheDocument();
    expect(screen.getByText("18.2% after 19 months")).toBeInTheDocument();
    expect(screen.getByText("₹9,36,610.00")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Since purchase" }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === "/expenses/ownership").at(-1)?.params).toEqual({
        vehicleId: victoris.id,
        period: "all_time",
      }),
    );
    expect((await screen.findAllByText("₹3,00,000.00")).length).toBeGreaterThan(0);
  });

  it("asks for the purchase price before estimating depreciation", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /expenses/ownership": () => ok(cost({ depreciation: null, principal: "0.00" })),
    });
    renderApp("/expenses/ownership");
    expect(
      await screen.findByText(/Add the purchase price and date to the vehicle/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit vehicle" })).toHaveAttribute(
      "href",
      `/garage/${victoris.id}/edit`,
    );
    expect(screen.getByText("Everything paid, a loan's full EMI included.")).toBeInTheDocument();
    expect(screen.queryByText("Depreciation (estimate)")).not.toBeInTheDocument();
  });
});
