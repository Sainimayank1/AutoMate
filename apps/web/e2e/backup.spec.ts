import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { addVehicle, signUp, visible } from "./helpers";

test("download a ZIP backup and restore it into another account", async ({ page }) => {
  const arjun = await signUp(page.request, "Arjun Mehta");
  await addVehicle(arjun);

  await page.goto("/backup");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup (.zip)" }).click();
  const zip = await (await download).path();

  // Now as Priya: her sign-up replaces Arjun's session cookie.
  await page.context().clearCookies();
  await signUp(page.request, "Priya Nair");
  await page.goto("/backup");
  await page.getByLabel("Backup file").setInputFiles({
    name: "automate-backup.zip",
    mimeType: "application/zip",
    buffer: await readFile(zip),
  });
  await page.getByRole("button", { name: "Restore 1 vehicle" }).click();
  await expect(visible(page, "Restored 1 vehicle.")).toBeVisible();

  await page.goto("/garage");
  await expect(visible(page, "Maruti Suzuki Victoris")).toBeVisible();
});
