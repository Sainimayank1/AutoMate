import { afterEach, describe, expect, it } from "vitest";

import { refreshSession, request } from "@/lib/api-client";
import { ApiError, isRetryableError, normalizeApiError } from "@/lib/api-error";
import { useSessionStore } from "@/stores/session-store";
import { fail, mockApi, ok, testSession, testUser } from "@/test/mock-api";

const signIn = (accessToken: string) =>
  useSessionStore.getState().setSession({ user: testUser, accessToken });

async function failure(...args: Parameters<typeof mockApi>) {
  mockApi(...args);
  return request({ url: "/x" }).then(
    () => {
      throw new Error("expected the request to fail");
    },
    (error: unknown) => error as ApiError,
  );
}

afterEach(() => {
  useSessionStore.getState().clearSession();
});

describe("request", () => {
  it("returns the envelope's data and sends the bearer token and cookies", async () => {
    signIn("token-123");
    const calls = mockApi(ok({ id: "v1" }));

    await expect(request<{ id: string }>({ url: "/vehicles/v1" })).resolves.toEqual({ id: "v1" });
    expect(calls[0]?.headers.Authorization).toBe("Bearer token-123");
    expect(calls[0]?.withCredentials).toBe(true);
  });

  it("maps field errors from the details, whatever the code", async () => {
    const validation = await failure(
      fail(400, "VALIDATION_ERROR", "Validation failed", [
        { field: "odometer", message: "Must be higher than the last reading." },
        { field: "odometer", message: "second message is ignored" },
        { nonsense: true },
      ]),
    );
    expect(validation).toBeInstanceOf(ApiError);
    expect(validation.status).toBe(400);
    expect(validation.code).toBe("VALIDATION_ERROR");
    expect(validation.message).toBe("Validation failed");
    expect(validation.fieldErrors).toEqual({ odometer: "Must be higher than the last reading." });
    expect(validation.requestId).toBe("req-1");

    const conflict = await failure(
      fail(409, "CONFLICT", "An account with this email already exists.", [
        { field: "email", message: "Already registered" },
      ]),
    );
    expect(conflict.fieldErrors).toEqual({ email: "Already registered" });
  });

  it("never shows server text for 5xx", async () => {
    const error = await failure(fail(500, "INTERNAL_ERROR", 'relation "vehicles" does not exist'));
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(isRetryableError(error)).toBe(true);
  });

  it("handles offline, timeouts and non-JSON bodies", async () => {
    expect((await failure("offline")).message).toMatch(/can't reach the server/i);
    expect((await failure("timeout")).message).toMatch(/timed out/i);

    const html = await failure({
      status: 404,
      data: "<html>Not Found</html>",
      headers: { "x-request-id": "h-9" },
    });
    expect(html.message).toBe("Something went wrong. Please try again.");
    expect(html.requestId).toBe("h-9");
    expect(isRetryableError(html)).toBe(false);
  });
});

describe("expired access tokens", () => {
  it("refreshes once and replays the request with the new token", async () => {
    signIn("expired");
    const calls = mockApi((config) => {
      if (config.url === "/auth/refresh") return ok(testSession("fresh"));
      return config.headers.Authorization === "Bearer fresh"
        ? ok({ id: "v1" })
        : fail(401, "UNAUTHORIZED", "Token expired");
    });

    await expect(request({ url: "/vehicles/v1" })).resolves.toEqual({ id: "v1" });
    expect(calls.map((call) => call.url)).toEqual([
      "/vehicles/v1",
      "/auth/refresh",
      "/vehicles/v1",
    ]);
    expect(useSessionStore.getState().session?.accessToken).toBe("fresh");
  });

  it("signs out when the refresh cookie is no longer valid", async () => {
    signIn("expired");
    mockApi((config) =>
      config.url === "/auth/refresh"
        ? fail(401, "UNAUTHORIZED", "Your session has expired.")
        : fail(401, "UNAUTHORIZED", "Token expired"),
    );

    const error = await request<never>({ url: "/vehicles" }).catch(
      (caught: unknown) => caught as ApiError,
    );
    expect(error.status).toBe(401);
    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", session: null });
  });

  it("shares one refresh between concurrent 401s (the server rotates the cookie)", async () => {
    signIn("expired");
    const calls = mockApi((config) => {
      if (config.url === "/auth/refresh") return ok(testSession("fresh"));
      return config.headers.Authorization === "Bearer fresh"
        ? ok(config.url)
        : fail(401, "UNAUTHORIZED", "Token expired");
    });

    await expect(Promise.all([request({ url: "/a" }), request({ url: "/b" })])).resolves.toEqual([
      "/a",
      "/b",
    ]);
    expect(calls.filter((call) => call.url === "/auth/refresh")).toHaveLength(1);
  });

  it("never refreshes for the auth routes themselves", async () => {
    const calls = mockApi(fail(401, "UNAUTHORIZED", "Incorrect email or password."));
    const error = await request<never>({ method: "POST", url: "/auth/login" }).catch(
      (caught: unknown) => caught as ApiError,
    );
    expect(error.message).toBe("Incorrect email or password.");
    expect(calls).toHaveLength(1);
  });

  it("refreshSession restores a session from the cookie", async () => {
    mockApi(ok(testSession("from-cookie")));
    await expect(refreshSession()).resolves.toBe(true);
    expect(useSessionStore.getState()).toMatchObject({
      status: "authenticated",
      session: { user: testUser, accessToken: "from-cookie" },
    });
  });
});

describe("normalizeApiError", () => {
  it("wraps unknown errors with a safe message", () => {
    const error = normalizeApiError(new TypeError("x is undefined"));
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(error.status).toBeNull();
  });
});
