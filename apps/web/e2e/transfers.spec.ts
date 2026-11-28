import { expect, test } from "@playwright/test";

import { addVehicle, signUp, visible } from "./helpers";

test("offer a vehicle to another account, which accepts it with its records", async ({
  page,
  browser,
}, info) => {
  const arjun = await signUp(page.request, "Arjun Mehta");
  const car = await addVehicle(arjun);
  // Priya, in her own browser.
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL } = info.project.use;
  const other = await browser.newContext({
    viewport,
    isMobile,
    hasTouch,
    userAgent,
    deviceScaleFactor,
    baseURL,
  });
  const priya = await signUp(other.request, "Priya Nair");

  await page.goto(`/garage/${car.id}`);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Transfer to another account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Their account email").fill(priya.email);
  await dialog.getByRole("button", { name: "Send transfer request" }).click();
  await expect(visible(page, `Transfer to ${priya.email} waiting since`)).toBeVisible();

  const recipient = await other.newPage();
  await recipient.goto("/garage");
  const offer = recipient.getByRole("region", { name: /Arjun Mehta .* wants to move/ });
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: "Accept vehicle" }).click();
  await expect(recipient).toHaveURL(/\/garage\/[0-9a-f-]{36}$/);
  await expect(visible(recipient, "Maruti Suzuki Victoris")).toBeVisible();
  await recipient.goto("/fuel");
  await expect(visible(recipient, "₹3,129.60")).toBeVisible();
  await other.close();

  // Gone from Arjun's garage.
  await page.goto(`/garage/${car.id}`);
  await expect(visible(page, /not found|isn't in your garage/i)).toBeVisible();
});
