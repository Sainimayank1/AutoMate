import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it } from "vitest";

import { appModules } from "@/app/modules";
import { AppProviders } from "@/app/providers/app-providers";
import { routes } from "@/app/router/routes";
import { useSessionStore } from "@/stores/session-store";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

function signIn() {
  useSessionStore.getState().setSession({
    user: { id: "u1", name: "Test User", email: "test@example.com" },
    accessToken: null,
  });
}

afterEach(() => useSessionStore.getState().clearSession());

describe("app shell", () => {
  it("sends signed-out users to the login page", async () => {
    const router = renderAt("/fuel");
    expect(await screen.findByText("Sign in to AutoMate")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("lists all 12 modules in the navigation and opens the requested one", async () => {
    signIn();
    renderAt("/fuel");

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
    const router = renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");

    await router.navigate("/nope");
    const main = await screen.findByRole("main");
    expect(await within(main).findByText("Page not found")).toBeInTheDocument();
  });
});
