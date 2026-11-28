import type { SessionInfo, UserPreferences } from "@automate/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { useActiveVehicleStore } from "@/stores/vehicle-store";
import { fail, mockApi, type MockReply, ok, okPage, testUser, testVehicle } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const victoris = testVehicle();
const preferences: UserPreferences = {
  theme: "DARK",
  defaultVehicleId: null,
  notifications: {
    enabled: true,
    documents: true,
    maintenance: true,
    payments: true,
    trips: true,
    fuel: true,
    monthlySummary: false,
  },
  regional: {
    currency: "INR",
    distanceUnit: "km",
    dateFormat: "DD/MM/YYYY",
    timeZone: "Asia/Kolkata",
    language: "en-IN",
  },
};
const session = (overrides: Partial<SessionInfo>): SessionInfo => ({
  id: "0190d4a2-0000-7000-8000-00000000a001",
  device: "Chrome on Windows",
  createdAt: "2026-11-01T04:00:00.000Z",
  lastUsedAt: "2026-11-28T04:00:00.000Z",
  persistent: true,
  current: true,
  ...overrides,
});
const phone = session({
  id: "0190d4a2-0000-7000-8000-00000000a002",
  device: "Safari on iPhone",
  current: false,
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
  "GET /users/me/preferences": () => ok(preferences),
  "GET /auth/sessions": () => okPage([session({}), phone]),
};
const body = (config?: InternalAxiosRequestConfig) =>
  typeof config?.data === "string" ? (JSON.parse(config.data) as unknown) : config?.data;

beforeEach(() => {
  useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });
  useActiveVehicleStore.setState({ activeVehicleId: null });
});

describe("settings", () => {
  it("saves preferences and reminder switches to the account", async () => {
    const calls = api({
      ...base,
      "PATCH /users/me/preferences": (config) =>
        ok({ ...preferences, ...(body(config) as object) }),
    });
    renderApp("/settings");
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: testUser.name })).toBeInTheDocument();
    await user.click(await screen.findByRole("radio", { name: "Light" }));
    await user.click(screen.getByRole("switch", { name: "Trip reminders" }));
    const patches = () =>
      calls.filter((call) => call.method === "patch" && call.url === "/users/me/preferences");
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches().map(body)).toEqual([{ theme: "LIGHT" }, { notifications: { trips: false } }]);
    expect(screen.getByText("DD/MM/YYYY")).toBeInTheDocument();
  });

  it("turns every reminder off with the master switch", async () => {
    api({
      ...base,
      "GET /users/me/preferences": () =>
        ok({ ...preferences, notifications: { ...preferences.notifications, enabled: false } }),
    });
    renderApp("/settings");
    expect(await screen.findByRole("switch", { name: "Service due" })).toBeDisabled();
    expect(screen.getByText("Notifications are off: no reminders at all.")).toBeInTheDocument();
  });

  it("lists signed-in devices and signs another one out", async () => {
    const calls = api({ ...base, [`DELETE /auth/sessions/${phone.id}`]: () => ok(null, 204) });
    renderApp("/settings");
    const user = userEvent.setup();

    const devices = within(
      (await screen.findByRole("heading", { name: "Signed-in devices" })).parentElement!,
    );
    expect(await devices.findByText("This device")).toBeInTheDocument();
    await user.click(devices.getByRole("button", { name: "Sign out Safari on iPhone" }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === "delete" && call.url?.endsWith(phone.id))).toBe(
        true,
      ),
    );
    expect(
      screen.getByRole("button", { name: "Sign out of all other devices" }),
    ).toBeInTheDocument();
  });

  it("deletes the account only with the password and DELETE, then signs out", async () => {
    const calls = api({ ...base, "POST /users/me/delete": () => ok(null, 204) });
    renderApp("/settings");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Password"), "Drive2026safe");
    await user.type(dialog.getByLabelText("Type DELETE to confirm"), "delete");
    await user.click(dialog.getByRole("button", { name: "Delete account" }));
    await waitFor(() =>
      expect(dialog.getByLabelText("Type DELETE to confirm")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(calls.some((call) => call.url === "/users/me/delete")).toBe(false);

    await user.clear(dialog.getByLabelText("Type DELETE to confirm"));
    await user.type(dialog.getByLabelText("Type DELETE to confirm"), "DELETE");
    await user.click(dialog.getByRole("button", { name: "Delete account" }));
    await waitFor(() => expect(useSessionStore.getState().session).toBeNull());
    expect(body(calls.find((call) => call.url === "/users/me/delete"))).toEqual({
      password: "Drive2026safe",
      confirm: "DELETE",
    });
  });
});
