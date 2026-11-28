import type { Budget, ExpenseCategory } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const ID = (n: number) => `0190d4a2-0000-7000-8000-0000000b${String(n).padStart(4, "0")}`;
const category = (id: string, key: string, name: string): ExpenseCategory => ({
  id,
  key,
  name,
  icon: "route",
  costClass: "OPERATING",
  parentId: null,
  custom: false,
  active: true,
  usage: 0,
  subcategories: [],
});
const daily = category(ID(1), "DAILY_USAGE", "Daily usage");
const fuel = category(ID(2), "FUEL", "Fuel");
const ref = (c: ExpenseCategory) => ({
  id: c.id,
  key: c.key,
  name: c.name,
  icon: c.icon,
  costClass: c.costClass,
});
const month = { from: "2026-11-01", to: "2026-11-30" };
const budget = (overrides: Partial<Budget>): Budget => ({
  id: ID(100),
  vehicleId: victoris.id,
  category: null,
  period: "MONTH",
  amount: "20000.00",
  alertPercent: 80,
  window: month,
  spent: "16978.00",
  remaining: "3022.00",
  percent: 84,
  state: "WARNING",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...overrides,
});
const overall = budget({});
const over = budget({
  id: ID(101),
  category: ref(daily),
  amount: "400.00",
  spent: "500.00",
  remaining: "-100.00",
  percent: 125,
  state: "OVER",
});
const onTrack = budget({
  id: ID(102),
  category: ref(fuel),
  amount: "9000.00",
  spent: "6718.21",
  remaining: "2281.79",
  percent: 74,
  state: "ON_TRACK",
});

type Routes = Record<string, (config: InternalAxiosRequestConfig) => MockReply>;
function api(routes: Routes) {
  return mockApi((config) => {
    const key = `${(config.method ?? "get").toUpperCase()} ${config.url}`;
    return routes[key]?.(config) ?? fail(404, "NOT_FOUND", "Not found");
  });
}
const base: Routes = {
  "GET /vehicles": () => okPage([victoris]),
  "GET /expense-categories": () => okPage([daily, fuel]),
  "GET /expense-budgets": () => okPage([overall, over, onTrack]),
};
const bodyOf = (config: InternalAxiosRequestConfig | undefined) =>
  JSON.parse(String(config?.data)) as Record<string, unknown>;
const cardOf = (title: string) =>
  within(screen.getByRole("heading", { level: 3, name: title }).closest("[data-slot=card]")!);

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("budgets", () => {
  it("shows each budget against its limit, and how many are over, near or on track", async () => {
    const calls = api(base);
    renderApp("/expenses/budgets");

    const summary = within(await screen.findByRole("region", { name: "Budgets by state" }));
    expect(summary.getByText("Over budget").nextSibling).toHaveTextContent("1");
    expect(summary.getByText("Near the limit").nextSibling).toHaveTextContent("1");
    expect(summary.getByText("On track").nextSibling).toHaveTextContent("1");
    expect(calls.find((call) => call.url === "/expense-budgets")?.params).toMatchObject({
      vehicleId: victoris.id,
    });

    const everything = cardOf("Everything on this vehicle");
    expect(everything.getByText("November 2026")).toBeInTheDocument();
    expect(everything.getByText("₹3,022.00 left · warns at 80%")).toBeInTheDocument();
    expect(
      everything.getByRole("progressbar", {
        name: "Everything on this vehicle: 84% of the limit spent",
      }),
    ).toBeInTheDocument();
    const dailyCard = cardOf("Daily usage");
    expect(dailyCard.getByText("Over budget")).toBeInTheDocument();
    expect(dailyCard.getByText("Over by ₹100.00")).toHaveClass("text-destructive");
    expect(dailyCard.getByText("125%")).toHaveClass("text-destructive");
    expect(cardOf("Fuel").getByText("₹2,281.79 left · warns at 80%")).toBeInTheDocument();
  });

  it("invites the first budget", async () => {
    api({ ...base, "GET /expense-budgets": () => okPage([]) });
    renderApp("/expenses/budgets");
    expect(await screen.findByText("No budgets yet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Budgets" })).toHaveAttribute("aria-selected", "true");
  });

  it("adds a yearly category budget, showing the API's conflict in the dialog", async () => {
    let tries = 0;
    const calls = api({
      ...base,
      "POST /expense-budgets": (config) =>
        ++tries === 1
          ? fail(409, "CONFLICT", "This category already has a budget for this vehicle.")
          : ok({ ...onTrack, ...bodyOf(config) }, 201),
    });
    renderApp("/expenses/budgets");
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: "Add budget" }))[0]!);
    const dialog = within(await screen.findByRole("dialog", { name: "Add budget" }));
    await user.click(dialog.getByRole("combobox", { name: "Category" }));
    await user.click(await screen.findByRole("option", { name: "Daily usage" }));
    await user.click(dialog.getByRole("radio", { name: "Yearly" }));
    await user.type(dialog.getByRole("textbox", { name: "Limit" }), "5000");
    await user.click(dialog.getByRole("button", { name: "Save budget" }));

    expect(
      await dialog.findByText("This category already has a budget for this vehicle."),
    ).toBeInTheDocument();
    expect(bodyOf(calls.find((call) => call.method === "post"))).toEqual({
      vehicleId: victoris.id,
      categoryId: daily.id,
      period: "YEAR",
      amount: "5000",
      alertPercent: 80,
    });
    await user.click(dialog.getByRole("button", { name: "Save budget" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edits only the limit and alert, and deletes after asking", async () => {
    const calls = api({
      ...base,
      [`PATCH /expense-budgets/${over.id}`]: (config) => ok({ ...over, ...bodyOf(config) }),
      [`DELETE /expense-budgets/${over.id}`]: () => ({ status: 204, data: "" }),
    });
    renderApp("/expenses/budgets");
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: "Actions for the Daily usage budget" }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit budget" }));
    expect(dialog.getByRole("combobox", { name: "Category" })).toBeDisabled();
    const limit = dialog.getByRole("textbox", { name: "Limit" });
    await user.clear(limit);
    await user.type(limit, "600");
    await user.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(bodyOf(calls.find((call) => call.method === "patch"))).toEqual({
        period: "MONTH",
        amount: "600",
        alertPercent: 80,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Actions for the Daily usage budget" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const confirm = within(
      await screen.findByRole("alertdialog", { name: "Delete the Daily usage budget?" }),
    );
    await user.click(confirm.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((call) => call.method === "delete")).toBe(true));
  });
});
