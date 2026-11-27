import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env itself. Deployed environments inject real env vars instead.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Read lazily (not env()) so `prisma generate` works in CI without a database URL.
  datasource: { url: process.env.DATABASE_URL },
});
