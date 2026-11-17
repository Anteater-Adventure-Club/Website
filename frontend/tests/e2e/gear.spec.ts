import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Schema } from "../../src/lib/api";

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
  await expect(page.getByText("Expired officer tent")).toHaveCount(0);
  await expect(page.getByText("Staff expedition tent")).toHaveCount(0);
  await expect(
    page.getByText("Officer owned / not guaranteed", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: /Please briefly describe the activities/ })
    .fill(activity);
  await accessible(page);
  await page.getByRole("button", { name: "Submit gear request" }).click();
  await expect(page.getByRole("heading", { name: activity })).toBeVisible();
  await enter(page, "second", "request");
  await expect(
    page.getByRole("checkbox", { name: /Naturehike Cloud Up 2/ }),
  ).toBeDisabled();
  await enter(page, "helper", "rentals");
  await page.getByLabel("Search rentals").fill(activity);
  await page.getByRole("button", { name: "Details", exact: true }).click();
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
  const catalogReads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/gear")
      catalogReads.push(request.url());
  });
  async function expectMembershipCardOnly() {
    await expect(
      page.getByRole("button", { name: "Request gear" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "My rentals" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Check another pickup date" }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Pickup date")).toHaveCount(0);
    await expect(page.getByLabel("Return date")).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByLabel("Search rentals")).toHaveCount(0);
    expect(catalogReads).toEqual([]);
  }
  await enter(page, "unpaid", "request");
  await expect(
    page.getByRole("link", { name: "Go to Membership Signup" }),
  ).toBeVisible();
  await expectMembershipCardOnly();
  await enter(page, "dues", "history");
  await expect(
    page.getByRole("link", { name: "View membership status" }),
  ).toBeVisible();
  await expectMembershipCardOnly();
  await enter(page, "applicant", "history");
  await expect(
    page.getByRole("link", { name: "Start application" }),
  ).toBeVisible();
  await expectMembershipCardOnly();
  await enter(page, "other", "rentals");
  await expect(page).toHaveURL(/admin\/officers/);
  await enter(page, "helper", "inventory");
  await expect(
    page
      .getByRole("table", { name: "Gear inventory" })
      .getByText("Expired officer tent"),
  ).toBeVisible();
  await accessible(page);
  const inventoryFilter = page.getByLabel("Show inventory");
  await inventoryFilter.selectOption("rentable");
  await expect(page.getByText("Expired officer tent")).toHaveCount(0);
  await inventoryFilter.selectOption("expired");
  await expect(page.getByText("Expired officer tent")).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Gear inventory" })
      .getByText("Loan expired", { exact: true })
      .first(),
  ).toBeVisible();
  await inventoryFilter.selectOption("active");
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
  const search = await page.getByLabel("Search rentals").boundingBox();
  const filter = await page.getByLabel("Rental status").boundingBox();
  if (!search || !filter) throw new Error("Rental filters are not visible");
  if (page.viewportSize()!.width > 560)
    expect(Math.abs(search.y - filter.y)).toBeLessThan(1);
  else expect(search.x).toBe(filter.x);
  await expect(
    page.getByRole("table", { name: "Gear rental requests" }),
  ).toBeVisible();
  await accessible(page);
});

test("dues cards reflect signup availability and payment holds", async ({
  page,
}) => {
  let paused = true;
  await page.route("**/api/quarters?*", async (route) => {
    const response = await route.fetch();
    const data: Schema<"Page_QuarterPublic_"> = await response.json();
    for (const quarter of data.items) {
      quarter.state = paused ? "open" : "finalized";
      quarter.membership_signups_paused = paused;
    }
    await route.fulfill({ response, json: data });
  });
  await enter(page, "unpaid", "request");
  await expect(
    page.getByRole("heading", {
      name: "Membership signups are temporarily paused",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to Membership Signup" }),
  ).toHaveCount(0);
  paused = false;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Membership signup unavailable" }),
  ).toBeVisible();
  await page.route("**/api/me/restrictions", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 1,
            all_events: false,
            event_kinds: [],
            events: [],
            membership: true,
            created_at: new Date().toISOString(),
            expires_at: null,
            message: "",
          },
        ],
      } satisfies Schema<"Items_RestrictionView_">,
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Membership signup is restricted" }),
  ).toBeVisible();
  await enter(page, "dues", "request");
  await expect(
    page.getByRole("heading", { name: "Your payment submission is on hold" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View membership status" }),
  ).toHaveAttribute("href", /\/my-aac\/membership\?quarter=\d+/);
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
  await page
    .getByRole("textbox", { name: /Please briefly describe the activities/ })
    .fill(model);
  await page.getByRole("button", { name: "Assign and approve rental" }).click();
  await page.getByLabel("Search rentals").fill(model);
  await expect(
    page
      .getByRole("table", { name: "Gear rental requests" })
      .getByText("Approved", { exact: true }),
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
