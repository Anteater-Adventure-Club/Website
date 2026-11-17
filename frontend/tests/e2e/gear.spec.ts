import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function enter(page: Page, role: string, destination: string) {
  await page.goto("/demo");
  await page
    .locator(`form[action="/demo/login/${role}/${destination}"] button`)
    .click();
}
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => [v.id, v.nodes.map((n) => n.target)]),
  ).toEqual([]);
}
test("request, approve, pick up and return an officer-owned tent", async ({
  page,
}, info) => {
  const activity = "Tent handoff " + info.project.name + " " + Date.now();
  await enter(page, "member", "request");
  const tent = page.getByRole("checkbox", { name: /Naturehike Cloud Up 2/ });
  await tent.check();
  await expect(page.getByRole("checkbox", { name: /VEVOR/ })).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: /Expired officer/ }),
  ).toBeDisabled();
  await expect(page.getByText("Staff expedition tent")).toHaveCount(0);
  await expect(
    page.getByText("Officer owned / not guaranteed", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Trip or activity").fill(activity);
  await accessible(page);
  await page.getByRole("button", { name: "Submit gear request" }).click();
  await expect(page.getByRole("heading", { name: activity })).toBeVisible();
  await enter(page, "second", "request");
  await expect(
    page.getByRole("checkbox", { name: /Naturehike Cloud Up 2/ }),
  ).toBeDisabled();
  await enter(page, "helper", "rentals");
  await page.getByLabel("Search rentals").fill(activity);
  for (const verb of ["Approve", "Record pickup", "Record return"]) {
    await page.getByRole("button", { name: verb, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: verb, exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await enter(page, "member", "history");
  await page.getByLabel("Search rentals").fill(activity);
  await expect(
    page.locator(".gear-lines").getByText("Returned", { exact: true }),
  ).toBeVisible();
});
test("inventory, membership gate and delegated access", async ({ page }) => {
  await enter(page, "unpaid", "request");
  await expect(
    page.getByRole("link", { name: "View membership" }),
  ).toBeVisible();
  await enter(page, "other", "rentals");
  await expect(page).toHaveURL(/admin\/officers/);
  await enter(page, "helper", "inventory");
  await page.getByRole("button", { name: "Add equipment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Ownership", exact: true })
    .selectOption("officer");
  await expect(dialog.getByLabel("Loan expiry")).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add equipment" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Manage types" }).click();
  await expect(page.getByLabel("Type name")).toBeVisible();
  await page.keyboard.press("Escape");
  await enter(page, "officer", "overview");
  await page
    .getByRole("link", { name: /Gear rentals waiting for approval/ })
    .click();
  await expect(page.getByLabel("Rental status")).toHaveValue("pending");
});

test("a gear helper adds inventory and assigns an approved rental", async ({
  page,
}, info) => {
  const model = "Trail lantern " + info.project.name + " " + Date.now();
  await enter(page, "helper", "inventory");
  await page.getByRole("button", { name: "Manage types" }).click();
  await page.getByLabel("Type name").fill(model);
  await page.getByRole("button", { name: "Save type" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add equipment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Model or item name").fill(model);
  await dialog
    .getByRole("combobox", { name: "Gear type" })
    .selectOption({ label: model });
  await dialog.getByLabel("Quantity owned or on loan").fill("4");
  await dialog.getByLabel("Available for member rental").check();
  await dialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Assign gear" }).click();
  await page.getByLabel("Search members").fill("Alex Rivera");
  await page.getByRole("button", { name: /Alex Rivera ·/ }).click();
  await page.getByRole("checkbox", { name: new RegExp(model) }).check();
  await page.getByLabel("Trip or activity").fill(model);
  await page.getByRole("button", { name: "Assign and approve rental" }).click();
  await page.getByLabel("Search rentals").fill(model);
  await expect(
    page.locator(".gear-lines").getByText("Approved", { exact: true }),
  ).toBeVisible();
  await enter(page, "member", "history");
  await page.getByLabel("Search rentals").fill(model);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.locator(".gear-lines").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
});
