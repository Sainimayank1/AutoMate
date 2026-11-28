import { defineConfig, devices } from "@playwright/test";

/**
 * Browser e2e: the real web app against a real API and database. Locally it reuses dev servers
 * already running (or starts `pnpm dev` / `pnpm dev:api`) and drives the installed Google Chrome,
 * so no browser download is needed; CI installs Playwright's Chromium (see ci.yml "browser").
 * E2E_BASE_URL points it at another web server (e.g. a preview build).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  // Generous: a sign-up may wait out the API's rate limit (helpers.ts).
  timeout: 150_000,
  expect: { timeout: 10_000 },
  // One file at a time: the API allows 10 sign-ups a minute per address (helpers.ts retries).
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...(ci ? {} : { channel: "chrome" }) },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], ...(ci ? {} : { channel: "chrome" }) },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "pnpm --filter @automate/api dev",
          url: "http://localhost:3000/api/v1/health",
          reuseExistingServer: !ci,
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @automate/web dev",
          url: baseURL,
          reuseExistingServer: !ci,
          timeout: 120_000,
        },
      ],
});
