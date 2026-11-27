import { describe, expect, it } from "vitest";

import { validateEnv } from "./env.validation";

const base = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/automate",
  JWT_ACCESS_SECRET: "x".repeat(32),
};

describe("validateEnv", () => {
  it("applies development defaults", () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: "development",
      PORT: 3000,
      API_PREFIX: "api",
      API_VERSION: "v1",
      FRONTEND_URL: ["http://localhost:5173"],
      LOG_LEVEL: "debug",
      SWAGGER_ENABLED: true,
      REDIS_ENABLED: false,
    });
  });

  it("disables Swagger and lowers log level in production by default", () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: "production",
      FRONTEND_URL: "https://app.example.com",
    });
    expect(env.SWAGGER_ENABLED).toBe(false);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("treats blank values as unset", () => {
    expect(validateEnv({ ...base, PORT: "", JWT_REFRESH_SECRET: "" }).PORT).toBe(3000);
  });

  it("splits comma-separated origins", () => {
    const env = validateEnv({ ...base, FRONTEND_URL: "https://a.com, https://b.com" });
    expect(env.FRONTEND_URL).toEqual(["https://a.com", "https://b.com"]);
  });

  it("rejects a wildcard origin in production", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "production", FRONTEND_URL: "*" })).toThrow(
      /FRONTEND_URL/,
    );
  });

  it("requires a strong access secret without echoing it", () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: "short-secret" })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: "short-secret" })).not.toThrow(
      /short-secret/,
    );
  });

  it("requires DATABASE_URL to be a postgres URL", () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("requires storage credentials only when a provider is set", () => {
    expect(() => validateEnv(base)).not.toThrow();
    expect(() => validateEnv({ ...base, STORAGE_PROVIDER: "r2" })).toThrow(/STORAGE_BUCKET/);
  });
});
