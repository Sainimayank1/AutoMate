import { z } from "zod";

const flag = z.enum(["true", "false"]).transform((value) => value === "true");

/** Comma-separated origins, e.g. "https://automate.app,https://www.automate.app". */
const origins = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.union([z.literal("*"), z.url({ protocol: /^https?$/ })])).min(1));

const STORAGE_KEYS = [
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .default("api"),
    API_VERSION: z
      .string()
      .regex(/^v\d+$/, "must look like v1")
      .default("v1"),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    FRONTEND_URL: origins.default(["http://localhost:5173"]),
    /** Reverse-proxy hops in front of the API (Render: 1), so rate limits see the real client IP. */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    SWAGGER_ENABLED: flag.optional(),

    // The global auth guard verifies access tokens on every non-public route, so this is always required.
    JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
    /**
     * SameSite for the refresh-token cookie. Keep "lax" when web and API share a site
     * (localhost, or app.example.in + api.example.in); "none" (always Secure) only if they don't.
     */
    REFRESH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),

    REDIS_ENABLED: flag.default(false),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),

    /**
     * Reverse geocoding for the fuel form's automatic location. Any Nominatim-compatible
     * `/reverse` endpoint: the public OpenStreetMap one (default; fine for development, max
     * 1 request/s) or a keyed provider such as LocationIQ in production (key sent as `key`).
     */
    GEOCODER_URL: z
      .url({ protocol: /^https?$/ })
      .default("https://nominatim.openstreetmap.org/reverse"),
    GEOCODER_API_KEY: z.string().optional(),

    STORAGE_PROVIDER: z.enum(["r2", "s3"]).optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.FRONTEND_URL.includes("*")) {
      ctx.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message: "wildcard origin is not allowed in production",
      });
    }
    if (env.STORAGE_PROVIDER) {
      for (const key of STORAGE_KEYS) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "required when STORAGE_PROVIDER is set",
          });
        }
      }
    }
  })
  .transform((env) => {
    const isProduction = env.NODE_ENV === "production";
    return {
      ...env,
      LOG_LEVEL: env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
      // Swagger is never public in production unless explicitly enabled.
      SWAGGER_ENABLED: env.SWAGGER_ENABLED ?? !isProduction,
    };
  });

export type Env = z.output<typeof envSchema>;

/**
 * Used by ConfigModule to validate process.env (plus .env) once at startup.
 * Blank values count as unset, so `KEY=` in .env falls back to the default.
 * Error messages name the variable, never its value.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const present = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
