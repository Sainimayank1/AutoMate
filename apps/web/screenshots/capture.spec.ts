import { expect, type Page, test } from "@playwright/test";

/** The demo account `pnpm db:seed:demo` creates (apps/api/prisma/seed-demo.ts). */
const DEMO = { email: "demo@automate.example", password: "AutoMate-demo-2026" };
const OUT = "../../docs/assets/screenshots";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(DEMO.email);
  await page.getByLabel("Password", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Waits for data and charts to settle, then saves the viewport. */
async function capture(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-slot=skeleton]")).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("screens", async ({ page }) => {
    await signIn(page);
    for (const [name, path] of [
      ["dashboard", "/"],
      ["garage", "/garage"],
      ["fuel", "/fuel"],
      ["expenses", "/expenses"],
      ["maintenance", "/maintenance"],
      ["maintenance-analytics", "/maintenance/analytics"],
      ["documents", "/documents"],
      ["trips", "/trips/history"],
      ["analytics", "/analytics"],
    ] as const) {
      await capture(page, path, name);
    }
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("screens", async ({ page }) => {
    await signIn(page);
    await capture(page, "/", "mobile-dashboard");
    await capture(page, "/fuel", "mobile-fuel");
    await capture(page, "/maintenance", "mobile-maintenance");
  });
});
