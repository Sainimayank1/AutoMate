import type { ApiErrorResponse, ApiSuccessResponse } from "@automate/shared";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { apiClient, request } from "@/lib/api-client";
import { ApiError, isRetryableError, normalizeApiError } from "@/lib/api-error";
import { useSessionStore } from "@/stores/session-store";

type Reply = { status: number; data?: unknown; headers?: Record<string, string> };

/** Swap axios's network layer so interceptors run for real against a canned reply. */
function mockServer(reply: Reply | "offline" | "timeout") {
  let seen: InternalAxiosRequestConfig | undefined;
  apiClient.defaults.adapter = async (config) => {
    seen = config;
    if (reply === "offline") throw new AxiosError("Network Error", "ERR_NETWORK", config);
    if (reply === "timeout") throw new AxiosError("timeout", "ECONNABORTED", config);
    const response: AxiosResponse = {
      data: reply.data ?? "",
      status: reply.status,
      statusText: "",
      headers: reply.headers ?? {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, response);
    }
    return response;
  };
  return () => seen;
}

function errorBody(overrides: Partial<ApiErrorResponse["error"]> & { message?: string }) {
  const { message = "Request failed", ...error } = overrides;
  return {
    success: false,
    message,
    error: { code: "BAD_REQUEST", details: [], requestId: "req-1", ...error },
  } satisfies ApiErrorResponse;
}

async function failure(reply: Parameters<typeof mockServer>[0]) {
  mockServer(reply);
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
  it("returns the envelope's data and sends the bearer token", async () => {
    useSessionStore.getState().setSession({
      user: { id: "u1", name: "A", email: "a@example.com" },
      accessToken: "token-123",
    });
    const body: ApiSuccessResponse<{ id: string }> = {
      success: true,
      message: "OK",
      data: { id: "v1" },
      meta: null,
    };
    const seen = mockServer({ status: 200, data: body });

    await expect(request<{ id: string }>({ url: "/vehicles/v1" })).resolves.toEqual({ id: "v1" });
    expect(seen()?.headers.Authorization).toBe("Bearer token-123");
  });

  it("maps validation errors onto fields", async () => {
    const error = await failure({
      status: 400,
      data: errorBody({
        message: "Please fix the highlighted fields.",
        code: "VALIDATION_ERROR",
        details: [
          { field: "odometer", message: "Must be higher than the last reading." },
          { field: "odometer", message: "second message is ignored" },
          { nonsense: true },
        ],
      }),
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Please fix the highlighted fields.");
    expect(error.fieldErrors).toEqual({ odometer: "Must be higher than the last reading." });
    expect(error.requestId).toBe("req-1");
  });

  it("never shows server text for 5xx", async () => {
    const error = await failure({
      status: 500,
      data: errorBody({ message: 'relation "vehicles" does not exist', code: "INTERNAL_ERROR" }),
    });
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

  it("clears the session on 401", async () => {
    useSessionStore.getState().setSession({
      user: { id: "u1", name: "A", email: "a@example.com" },
      accessToken: "expired",
    });
    await failure({
      status: 401,
      data: errorBody({ code: "UNAUTHORIZED", message: "Session expired." }),
    });
    expect(useSessionStore.getState().session).toBeNull();
  });
});

describe("normalizeApiError", () => {
  it("wraps unknown errors with a safe message", () => {
    const error = normalizeApiError(new TypeError("x is undefined"));
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(error.status).toBeNull();
  });
});
