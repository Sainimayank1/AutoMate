import { z } from "zod/mini";

const envSchema = z.object({
  /** An absolute URL, or a path on this site (`/api/v1`) when a proxy serves both, as in Docker. */
  VITE_API_BASE_URL: z.union([
    z.url(),
    z.string().check(z.regex(/^\/(?!\/)/, "must be a URL or a path such as /api/v1")),
  ]),
  /** Map tiles ({z}/{x}/{y}); OpenStreetMap's own when unset (light use, attribution shown). */
  VITE_MAP_TILE_URL: z.optional(z.string()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}\n` +
        "Copy apps/web/.env.example to apps/web/.env and fill in the values.",
    );
  }
  return result.data;
}

/** Validated at import time, so a missing variable fails on startup, not on first API call. */
export const env = parseEnv(import.meta.env);
