import { describe, expect, it } from "vitest";

import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("accepts a valid API URL", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://localhost:3000/api/v1" })).toEqual({
      VITE_API_BASE_URL: "http://localhost:3000/api/v1",
    });
  });

  it("fails with a helpful message when the API URL is missing or invalid", () => {
    expect(() => parseEnv({})).toThrow(/VITE_API_BASE_URL[\s\S]*\.env\.example/);
    expect(() => parseEnv({ VITE_API_BASE_URL: "not-a-url" })).toThrow(/VITE_API_BASE_URL/);
  });
});
