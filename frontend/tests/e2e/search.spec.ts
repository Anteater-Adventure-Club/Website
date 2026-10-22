import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:5173";
let fixture: any;
const names = [
  "Srinivasan Patel",
  "Srinivash Patel",
  "Srinivasen Shah",
  "Srinivasan Rao",
  "Sean Hayes",
  "Seann Hayes",
  "Shaun Hayes",
  "Shawn Hayes",
  "José García",
];

async function post(context: BrowserContext, url: string, data: unknown) {
  const response = await context.request.post(base + url, {
    data,
    headers: { Origin: base },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

function fieldPath() {
  const event = fixture.events.Field;
  return `/admin/events/${event.slug}/${event.id}`;
}

async function evidence(page: Page, label: string, project: string) {
  const root = path.resolve("../artifacts/search-review");
  fs.mkdirSync(root, { recursive: true });
  await page.screenshot({
    path: `${root}/${label}-${project}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations.map((v) => ({ id: v.id, impact: v.impact }))).toEqual(
    [],
  );
}

test.beforeEach(async ({ context, baseURL }) => {
  if (
    baseURL !== base ||
    new URL(base).hostname !== "localhost" ||
    !(process.env.DATABASE_URL || "").includes("127.0.0.1:55432/aac_browser")
  )
    throw new Error(
      "Search fixtures require an isolated local browser database",
    );
  execFileSync(process.env.E2E_PYTHON || "../.venv/bin/python", [
    "../scripts/seed-browser-fixtures.py",
  ]);
  fixture = JSON.parse(
    fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
  );
  await context.addCookies([
    {
      name: "aac_session",
      value: fixture.cookies.officer,
      domain: "localhost",
      path: "/",
    },
  ]);
  for (const [index, name] of names.entries()) {
    const member = await post(context, "/api/admin/members", {
      name,
      email: `search-${index}@uci.edu`,
      phone: "9495550123",
    });
    fixture.people[name] = member;
    const driver = name === "Srinivasan Rao";
    let vehicle;
    if (driver)
      vehicle = await post(
        context,
        `/api/admin/members/${member.id}/vehicles`,
        { year: 2024, make: "Toyota", model: "Corolla", capacity: 4 },
      );
    await post(
      context,
      `/api/admin/events/${fixture.events.Field.id}/signups`,
      {
        member_id: member.id,
        role: driver ? "driver" : "ride",
        ...(driver ? { vehicle_id: vehicle.id, seats: 3 } : {}),
      },
    );
  }
});

test("roster ranks unusual spellings, preserves groups and polling, and requires selection", async ({
  page,
  context,
}, testInfo) => {
  const response = await context.request.get(
    base + `/api/admin/events/${fixture.events.Field.id}/check-in`,
  );
  const before = await response.json();
  await page.goto(fieldPath() + "/check-in");
  const input = page.getByRole("textbox", { name: "Search check-in roster" });
  await input.fill("Srinivasn");
  const rows = page.locator(".checkin-person strong");
  await expect(rows).toHaveText([
    "Srinivasan Patel",
    "Srinivasen Shah",
    "Srinivash Patel",
  ]);
  await evidence(page, "roster-typo", testInfo.project.name);
  await page.waitForResponse(
    (r) =>
      r
        .url()
        .includes(`/api/admin/events/${fixture.events.Field.id}/check-in`) &&
      r.request().method() === "GET",
  );
  await expect(rows).toHaveText([
    "Srinivasan Patel",
    "Srinivasen Shah",
    "Srinivash Patel",
  ]);
  await page.getByRole("button", { name: /^Drivers / }).click();
  await expect(rows).toHaveText(["Srinivasan Rao"]);
  await page.getByRole("button", { name: /^Riders / }).click();
  await expect(rows).toHaveText([
    "Srinivasan Patel",
    "Srinivasen Shah",
    "Srinivash Patel",
  ]);
  const after = await (
    await context.request.get(
      base + `/api/admin/events/${fixture.events.Field.id}/check-in`,
    )
  ).json();
  expect(
    after.signups.map((s: any) => [s.id, s.checked_in_at, s.card]),
  ).toEqual(before.signups.map((s: any) => [s.id, s.checked_in_at, s.card]));
  await input.fill("zzzzzz");
  await expect(
    page.getByText("No close matches", { exact: true }),
  ).toBeVisible();
  await input.clear();
  await expect(rows).toHaveText(
    before.signups
      .filter((s: any) => s.role === "ride")
      .map((s: any) => s.name),
  );
});

test("sound-alike and accented names appear in the roster", async ({
  page,
}, testInfo) => {
  await page.goto(fieldPath() + "/check-in");
  const input = page.getByRole("textbox", { name: "Search check-in roster" });
  await input.fill("Sean");
  await expect(page.locator(".checkin-person strong")).toHaveText([
    "Sean Hayes",
    "Seann Hayes",
    "Shaun Hayes",
    "Shawn Hayes",
  ]);
  await evidence(page, "roster-sound-alike", testInfo.project.name);
  await input.fill("Jose Garcia");
  await expect(page.locator(".checkin-person strong")).toHaveText(["José García"]);
  await page.getByRole("button", { name: /José García/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "José García", exact: true }),
  ).toBeVisible();
});

test("walk-in lookup ranks all members, handles no matches and clears old choices", async ({
  page,
}, testInfo) => {
  await page.goto(fieldPath() + "/check-in");
  await page.getByRole("button", { name: "Walk-in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Find a member", { exact: true });
  await input.fill("Srinivasn");
  await expect(dialog.locator(".member-option strong")).toHaveText([
    "Srinivasan Patel",
    "Srinivasan Rao",
    "Srinivasen Shah",
    "Srinivash Patel",
  ]);
  await evidence(page, "walk-in-typo", testInfo.project.name);
  await input.clear();
  await expect(dialog.locator(".member-option")).toHaveCount(0);
  await input.fill("zzzzzz");
  await expect(
    dialog.getByText("No close matches. Try another name or email."),
  ).toBeVisible();
  await input.fill("Srinivasn");
  await dialog.getByRole("button", { name: /Srinivasan Patel/ }).click();
  await expect(
    dialog.getByRole("heading", { name: "Srinivasan Patel", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Add & Check In", exact: true }),
  ).toBeVisible();
});

test("member directory searches reordered and accented names with membership filters", async ({
  page,
}, testInfo) => {
  await page.goto("/admin/members");
  await page.getByLabel("Search members").fill("Patel Srinivasn");
  await expect(page.locator("tbody td[data-label='Member'] strong")).toHaveText(
    ["Srinivasan Patel", "Srinivash Patel"],
  );
  await evidence(page, "members-typo", testInfo.project.name);
  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No members match", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "General", exact: true }).click();
  await expect(page.locator("tbody td[data-label='Member'] strong")).toHaveText(
    ["Srinivasan Patel", "Srinivash Patel"],
  );
});

test("event participant search supports email and retains the role filter", async ({
  page,
}, testInfo) => {
  await page.goto(fieldPath());
  await expect(page.getByLabel("Search participants")).toBeVisible();
  await page.getByLabel("Search participants").fill("Srinivasn");
  await expect(page.locator("tbody td[data-label='Person'] strong")).toHaveText(
    [
      "Srinivasan Patel",
      "Srinivasan Rao",
      "Srinivasen Shah",
      "Srinivash Patel",
    ],
  );
  await page.getByLabel("Ride filter").selectOption("driver");
  await expect(page.locator("tbody td[data-label='Person'] strong")).toHaveText(
    ["Srinivasan Rao"],
  );
  await page.getByLabel("Search participants").fill("search-3@uci.edu");
  await expect(page.locator("tbody td[data-label='Person'] strong")).toHaveText(
    ["Srinivasan Rao"],
  );
  await evidence(page, "participants-email", testInfo.project.name);
});

test("reimbursement search and the shared driver picker use fuzzy names", async ({
  page,
  context,
}, testInfo) => {
  for (const name of ["Sean Hayes", "Shawn Hayes", "Shaun Hayes"])
    await post(context, `/api/admin/quarters/${fixture.quarter.id}/drivers`, {
      member_id: fixture.people[name].id,
    });
  await page.goto("/admin/reimbursements");
  await page
    .getByRole("button", { name: "Next: Drivers", exact: true })
    .click();
  await page.getByLabel("Search reimbursement drivers").fill("Sean");
  await expect(page.locator("tbody td[data-label='Driver'] strong")).toHaveText(
    ["Sean Hayes", "Shaun Hayes", "Shawn Hayes"],
  );
  await evidence(page, "reimbursements-sound-alike", testInfo.project.name);
  await page
    .getByRole("button", { name: "Register Driver", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Find an existing member").fill("Srinivasn");
  await expect(dialog.locator(".member-option strong")).toHaveText([
    "Srinivasan Patel",
    "Srinivasan Rao",
    "Srinivasen Shah",
    "Srinivash Patel",
  ]);
  await evidence(page, "shared-driver-picker", testInfo.project.name);
});

test("picker reports lookup failures separately from no matches and can retry", async ({
  page,
}) => {
  let failures = true;
  await page.route("**/api/admin/members?*", (route) =>
    failures
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Search temporarily unavailable" }),
        })
      : route.continue(),
  );
  await page.goto(fieldPath() + "/check-in");
  await page.getByRole("button", { name: "Walk-in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Find a member").fill("Srinivasn");
  await expect(dialog.getByRole("alert")).toHaveText(
    "Search temporarily unavailable",
  );
  await expect(
    dialog.getByText("No close matches. Try another name or email."),
  ).toHaveCount(0);
  failures = false;
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dialog.locator(".member-option strong").first()).toHaveText(
    "Srinivasan Patel",
  );
});
