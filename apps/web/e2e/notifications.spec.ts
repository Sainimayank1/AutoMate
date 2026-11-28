import { expect, test } from "@playwright/test";

import { addVehicle, signUp } from "./helpers";

test("an expiring document's notification opens its renewal", async ({ page }) => {
  const arjun = await signUp(page.request, "Arjun Mehta");
  const car = await addVehicle(arjun);
  const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await arjun.call("POST", "/documents", {
    vehicleId: car.id,
    type: "PUC",
    name: "PUC certificate",
    expiryDate: soon,
    fileIds: [],
  });

  await page.goto("/notifications");
  const notice = page.getByRole("article", { name: /^PUC certificate expires on/ });
  await notice.getByRole("link", { name: "Renew" }).click();
  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}\/edit\?renew=1$/);
  await expect(page.getByRole("heading", { name: "Renew document" })).toBeVisible();
});
