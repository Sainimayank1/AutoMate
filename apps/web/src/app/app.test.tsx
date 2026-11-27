import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { appModules } from "@/app/modules";
import { useSessionStore } from "@/stores/session-store";
import { fail, mockApi, ok, testSession, testUser } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

const signIn = () => useSessionStore.getState().setSession({ user: testUser, accessToken: "t" });

beforeEach(() => useSessionStore.getState().clearSession());

describe("session restore on page load", () => {
  it("restores a session from the refresh cookie and opens the requested page", async () => {
    useSessionStore.setState({ status: "unknown", session: null });
    const calls = mockApi((config) =>
      config.url === "/auth/refresh" ? ok(testSession()) : fail(404, "NOT_FOUND", "Not found"),
    );

    const router = renderApp("/fuel");
    expect(await screen.findByRole("heading", { level: 1, name: "Fuel" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/fuel");
    expect(calls.filter((call) => call.url === "/auth/refresh")).toHaveLength(1);
  });

  it("sends visitors without a valid cookie to sign in", async () => {
    useSessionStore.setState({ status: "unknown", session: null });
    mockApi(fail(401, "UNAUTHORIZED", "Your session has expired."));

    const router = renderApp("/fuel");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });
});

describe("app shell", () => {
  it("lists all 12 modules in the navigation and opens the requested one", async () => {
    signIn();
    renderApp("/fuel");

    expect(await screen.findByRole("heading", { level: 1, name: "Fuel" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const appModule of appModules) {
      expect(within(nav).getByRole("link", { name: appModule.title })).toHaveAttribute(
        "href",
        appModule.path,
      );
    }
    expect(appModules).toHaveLength(12);
  });

  it("redirects / to the dashboard and shows a not-found page for unknown paths", async () => {
    signIn();
    const router = renderApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");

    await router.navigate("/nope");
    const main = await screen.findByRole("main");
    expect(await within(main).findByText("Page not found")).toBeInTheDocument();
  });

  it("keeps signed-in users away from the sign-in page", async () => {
    signIn();
    const router = renderApp("/login");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
