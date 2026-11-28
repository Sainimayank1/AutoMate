import { expect, test } from "@playwright/test";

/**
 * The first-run path end to end: register, add a vehicle through the wizard, log a full-tank
 * fill-up, and see it on the dashboard and in Fuel. Each run signs up a fresh account.
 */
test("register, add a vehicle, log a fill-up and see it on the dashboard", async ({ page }) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const plate = `HR26EV${id.slice(-4)}`;

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Arjun Mehta");
  await page.getByLabel("Email address").fill(`e2e-${id}@automate.test`);
  await page.getByLabel("Password", { exact: true }).fill("Drive2026safe");
  await page.getByLabel("I agree to the Terms of Service and Privacy Policy").check();
  await page.getByRole("button", { name: "Create AutoMate account" }).click();
  await expect(page).not.toHaveURL(/\/register/);

  await page.goto("/garage/new");
  await page.getByLabel("Manufacturer").fill("Maruti Suzuki");
  await page.getByLabel("Model").fill("Victoris");
  await page.getByLabel("Variant (optional)").fill("LXI");
  await page.getByLabel("Manufacturing year").fill("2025");
  await page.getByLabel("Registration number").fill(plate);
  // The choice card covers its radio: click the card.
  await page
    .getByRole("radiogroup", { name: "Vehicle category" })
    .getByText("SUV", { exact: true })
    .click();
  await page.getByRole("button", { name: "Next: Specifications" }).click();
  await page.getByRole("button", { name: "Next: Ownership" }).click();
  await page.getByLabel("Current odometer").fill("8450");
  await page.getByRole("button", { name: "Next: Vehicle info" }).click();
  await page.getByRole("button", { name: "Next: Review" }).click();
  await page.getByRole("button", { name: "Add vehicle to garage" }).click();
  await expect(page).toHaveURL(/\/garage\/[0-9a-f-]{36}$/);

  await page.goto("/fuel/new");
  await page.getByLabel("Odometer reading").fill("8700");
  await page.getByLabel("Quantity (L)").fill("30");
  await page.getByLabel("Price per L").fill("104.32");
  await page.getByRole("button", { name: "Save fuel log" }).click();
  await expect(page).toHaveURL(/\/fuel$/);
  await expect(page.getByText("₹3,129.60").filter({ visible: true }).first()).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByText("Maruti Suzuki Victoris").filter({ visible: true }).first(),
  ).toBeVisible();
});
