import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useSessionStore } from "@/stores/session-store";
import { fail, mockApi, ok, testSession } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";

beforeEach(() => useSessionStore.getState().clearSession());

const PASSWORD = "Drive2026safe";

describe("sign in", () => {
  it("signs in and returns to the page the user asked for", async () => {
    const calls = mockApi(ok(testSession()));
    const router = renderApp("/trips"); // RequireAuth → /login, remembering /trips
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email address"), "  Arjun.Mehta@Example.in ");
    await user.type(screen.getByLabelText("Password"), PASSWORD);
    await user.click(screen.getByRole("checkbox", { name: "Keep me signed in on this device" }));
    await user.click(screen.getByRole("button", { name: "Sign in to AutoMate" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Trips" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/trips");
    // The shared schema normalises the email before it is sent.
    expect(JSON.parse(calls[0]?.data as string)).toEqual({
      email: "arjun.mehta@example.in",
      password: PASSWORD,
      rememberMe: false,
    });
  });

  it("shows the API's message for wrong credentials and stays on the page", async () => {
    mockApi(fail(401, "UNAUTHORIZED", "Incorrect email or password."));
    const router = renderApp("/login");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Email address"), "arjun.mehta@example.in");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in to AutoMate" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(useSessionStore.getState().status).toBe("anonymous");
  });

  it("toggles password visibility", async () => {
    renderApp("/login");
    const user = userEvent.setup();
    const password = await screen.findByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });
});

describe("registration", () => {
  it("validates every field before calling the API", async () => {
    const calls = mockApi(ok(testSession(), 201));
    renderApp("/register");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Password"), "lettersonly");
    await user.click(screen.getByRole("button", { name: "Create AutoMate account" }));

    expect(await screen.findByText("Enter your full name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Include at least one number")).toBeInTheDocument();
    expect(
      screen.getByText("Accept the Terms of Service and Privacy Policy to continue"),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("shows an already-registered email on the email field", async () => {
    mockApi(
      fail(409, "CONFLICT", "An account with this email already exists. Sign in instead.", [
        { field: "email", message: "An account with this email already exists" },
      ]),
    );
    renderApp("/register");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Arjun Mehta");
    await user.type(screen.getByLabelText("Email address"), "arjun.mehta@example.in");
    await user.type(screen.getByLabelText("Password"), PASSWORD);
    await user.click(screen.getByRole("checkbox", { name: /I agree to the Terms/ }));
    await user.click(screen.getByRole("button", { name: "Create AutoMate account" }));

    expect(
      await screen.findByText("An account with this email already exists"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
  });

  it("creates the account, signs in and opens the dashboard", async () => {
    mockApi(ok(testSession(), 201));
    const router = renderApp("/register");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Full name"), "Arjun Mehta");
    await user.type(screen.getByLabelText("Email address"), "arjun.mehta@example.in");
    await user.type(screen.getByLabelText("Password"), PASSWORD);
    await user.click(screen.getByRole("checkbox", { name: /I agree to the Terms/ }));
    await user.click(screen.getByRole("button", { name: "Create AutoMate account" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(await screen.findByText("Welcome to AutoMate, Arjun.")).toBeInTheDocument();
  });
});
