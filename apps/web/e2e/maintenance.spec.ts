import { expect, test } from "@playwright/test";

import { addVehicle, signUp, visible } from "./helpers";

test("plan a job with an estimate and apply a reviewed template", async ({ page }) => {
  const arjun = await signUp(page.request, "Arjun Mehta");
  const car = await addVehicle(arjun);
  await arjun.call("POST", `/vehicles/${car.id}/maintenance-schedules`, {
    name: "Replace tyres",
    categoryKey: "TYRES.REPLACEMENT",
    dueKm: 45000,
    estimatedCost: "24000",
  });

  await page.goto("/maintenance/planner");
  await expect(visible(page, "Replace tyres")).toBeVisible();
  await expect(visible(page, "est. ₹24,000.00")).toBeVisible();

  const card = page.locator("[data-slot=card]").filter({ hasText: "Two-wheeler" });
  await card.getByRole("button", { name: "Apply template" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Generic starting point — check your owner's manual"),
  ).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Spark plug" }).click();
  await dialog.getByRole("button", { name: "Add 5 schedules" }).click();
  await expect(page).toHaveURL(/\/maintenance\/schedules$/);
  await expect(visible(page, "Chain clean & adjust")).toBeVisible();
  await expect(page.getByText("Spark plug", { exact: true })).toHaveCount(0);

  // No service logged yet: the empty state, not zeros.
  await page.goto("/maintenance/analytics");
  await expect(visible(page, "No maintenance spending yet")).toBeVisible();
});
