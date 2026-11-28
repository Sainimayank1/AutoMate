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

/** Required for a bucket (r2 / s3); the local provider needs none of them. */
const STORAGE_KEYS = [
  "STORAGE_BUCKET",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_ENDPOINT",
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
    /**
     * Driving routes for trips: any OSRM-compatible server. The public demo (default) is for
     * development only (light use); point production at a hosted or self-run OSRM.
     */
    ROUTER_URL: z.url({ protocol: /^https?$/ }).default("https://router.project-osrm.org"),

    /**
     * Where document files live. `local` (the default outside production) keeps them on disk under
     * STORAGE_LOCAL_DIR and serves them through the API; production needs a private bucket.
     */
    STORAGE_PROVIDER: z.enum(["local", "r2", "s3"]).optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
    /** The bucket's S3 endpoint, e.g. https://<account>.r2.cloudflarestorage.com. */
    STORAGE_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    STORAGE_LOCAL_DIR: z.string().default(".storage"),
    /** The API's own origin as browsers reach it, for local upload and download links. */
    STORAGE_PUBLIC_URL: z.url({ protocol: /^https?$/ }).optional(),

    /**
     * Web Push (VAPID). All three or none: without them, push is off and the inbox works as
     * before. Generate a pair with `npx web-push generate-vapid-keys`.
     */
    PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
    PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
    /** Who push services can contact about this sender: a mailto: or https: URL. */
    PUSH_CONTACT: z
      .string()
      .regex(/^(mailto:|https:\/\/)/, "must be a mailto: or https:// URL")
      .optional(),
    /** Shared with the scheduled job that sends pushes (POST /internal/notifications/dispatch). */
    DISPATCH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.FRONTEND_URL.includes("*")) {
      ctx.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message: "wildcard origin is not allowed in production",
      });
    }
    if (env.NODE_ENV === "production" && env.STORAGE_PROVIDER === "local") {
      ctx.addIssue({
        code: "custom",
        path: ["STORAGE_PROVIDER"],
        message: "local storage is not allowed in production (files would be lost on redeploy)",
      });
    }
    const push = [env.PUSH_VAPID_PUBLIC_KEY, env.PUSH_VAPID_PRIVATE_KEY, env.PUSH_CONTACT];
    if (push.some(Boolean) && !push.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        path: ["PUSH_VAPID_PUBLIC_KEY"],
        message: "PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY and PUSH_CONTACT go together",
      });
    }
    if (env.STORAGE_PROVIDER === "r2" || env.STORAGE_PROVIDER === "s3") {
      for (const key of STORAGE_KEYS) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "required when STORAGE_PROVIDER is r2 or s3",
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
      // Without a bucket, development and tests keep files on disk; production has no uploads.
      STORAGE_PROVIDER: env.STORAGE_PROVIDER ?? (isProduction ? undefined : ("local" as const)),
      STORAGE_PUBLIC_URL: env.STORAGE_PUBLIC_URL ?? `http://localhost:${env.PORT}`,
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
