import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
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
  api({ "GET /vehicles": () => okPage([victoris]), "GET /fuel-entries": () => okPage([]) });
});

const reminderHref = `/notifications/reminders?new=1&vehicle=${victoris.id}`;

describe("mobile bottom navigation", () => {
  it("marks the current module and opens quick add for the active vehicle", async () => {
    renderApp("/expenses");
    const user = userEvent.setup();

    const nav = within(await screen.findByRole("navigation", { name: "Mobile navigation" }));
    expect(nav.getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");

    await user.click(nav.getByRole("button", { name: "Add" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Add" }));
    expect(await sheet.findByText(/HR26EV4821/)).toBeInTheDocument();
    expect(
      sheet.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Fuel entry", "/fuel/new"],
      ["Expense", "/expenses/new"],
      ["Service record", "/maintenance/records/new"],
      ["Trip", `/trips/new?vehicle=${victoris.id}`],
      ["Document", "/documents/new"],
      ["Reminder", reminderHref],
    ]);
  });

  it("offers the same shortcuts in the header's add menu", async () => {
    renderApp("/dashboard");
    const user = userEvent.setup();
    const header = within(await screen.findByRole("banner"));
    await user.click(await header.findByRole("button", { name: "Add" }));
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Fuel entry",
      "Expense",
      "Service record",
      "Trip",
      "Document",
      "Reminder",
    ]);
  });
});

describe("phone header", () => {
  it("switches vehicle on a module's main page and goes back from an inner one", async () => {
    const router = renderApp("/expenses");
    const header = within(await screen.findByRole("banner"));
    expect(
      await header.findByRole("button", { name: /^Active vehicle: .*Switch vehicle$/ }),
    ).toBeInTheDocument();
    expect(header.queryByRole("link", { name: /^Back to/ })).not.toBeInTheDocument();

    await act(() => router.navigate("/expenses/transactions"));
    expect(await header.findByRole("link", { name: "Back to Expenses" })).toHaveAttribute(
      "href",
      "/expenses",
    );
  });

  it("keeps the theme choice in the account menu", async () => {
    renderApp("/dashboard");
    const user = userEvent.setup();
    const header = within(await screen.findByRole("banner"));
    await user.click(await header.findByRole("button", { name: "Account menu" }));
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual([
      "Light",
      "Dark",
      "System",
    ]);
  });
});
