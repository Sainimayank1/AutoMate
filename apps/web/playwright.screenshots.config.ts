import { defineConfig } from "@playwright/test";

/**
 * Captures the README screenshots (docs/assets/screenshots) from the running app with the demo
 * data: `pnpm db:seed:demo`, then `pnpm --filter @automate/web screenshots`. Not part of the test
 * suite. Locally it drives the installed Google Chrome.
 */
export default defineConfig({
  testDir: "./screenshots",
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    channel: process.env.CI ? undefined : "chrome",
    colorScheme: "dark",
  },
});
