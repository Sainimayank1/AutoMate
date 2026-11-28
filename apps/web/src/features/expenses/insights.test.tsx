import type { ExpenseInsights } from "@automate/shared";
import { screen, within } from "@testing-library/react";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const insights: ExpenseInsights = {
  monthsOfHistory: 3,
  items: [
    {
      id: "budget:1",
      kind: "budget",
      tone: "negative",
      title: "Daily usage is over budget",
      explanation: "₹1,350.00 spent this month against a limit of ₹1,200.00: over by ₹150.00.",
      metric: { label: "Spent this month", value: "₹1,350.00", compared: "of ₹1,200.00" },
      action: { label: "View budgets", href: `/expenses/budgets?vehicle=${victoris.id}` },
    },
    {
      id: "duplicate:a:b",
      kind: "possible_duplicate",
      tone: "neutral",
      title: "Possible duplicate: NH-48 FASTag",
      explanation:
        "Two ₹640.00 Daily usage expenses on 21 Nov 2026. If one was entered twice, delete it.",
      metric: null,
      action: { label: "Review", href: "/expenses/transactions/b" },
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

describe("expense insights", () => {
  it("lists what stands out, each with where to look", async () => {
    const calls = api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /expenses/insights": () => ok(insights),
    });
    renderApp("/expenses/insights");

    const budget = within(
      (await screen.findByRole("heading", { name: /Over:\s*Daily usage is over budget/ })).closest(
        "li",
      )!,
    );
    expect(budget.getByText(/₹1,350.00 spent this month/)).toBeInTheDocument();
    expect(budget.getByRole("link", { name: "View budgets" })).toHaveAttribute(
      "href",
      `/expenses/budgets?vehicle=${victoris.id}`,
    );
    const duplicate = within(
      screen
        .getByRole("heading", { name: /Worth a look:\s*Possible duplicate: NH-48 FASTag/ })
        .closest("li")!,
    );
    expect(duplicate.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/expenses/transactions/b",
    );
    expect(screen.getByText("From your own records · rules, not AI")).toBeInTheDocument();
    expect(calls.find((call) => call.url === "/expenses/insights")?.params).toEqual({
      vehicleId: victoris.id,
    });
  });

  it("says when nothing stands out, and what more history unlocks", async () => {
    api({
      "GET /vehicles": () => okPage([victoris]),
      "GET /expenses/insights": () => ok({ items: [], monthsOfHistory: 1 }),
    });
    renderApp("/expenses/insights");
    expect(await screen.findByText(/Nothing stands out/)).toBeInTheDocument();
    expect(screen.getByText(/two of the last three months have expenses/)).toBeInTheDocument();
  });
});
