import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let fixture: any;
let event: any;
const origin = "http://localhost:5173";
async function identity(context: BrowserContext, role: string) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "aac_session",
      value: fixture.cookies[role],
      domain: "localhost",
      path: "/",
    },
  ]);
}
async function api(
  page: Page,
  url: string,
  method = "GET",
  body?: unknown,
  role = "officer",
) {
  const result = await page.request.fetch(url, {
    method,
    data: body,
    headers: { Origin: origin, Cookie: `aac_session=${fixture.cookies[role]}` },
  });
  expect(result.ok(), `${url}: ${await result.text()}`).toBeTruthy();
  return result.json();
}
function eventURL() {
  return `/events/${event.slug}/${event.id}`;
}
async function capture(page: Page, project: string, name: string) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const directory = path.resolve(
    `../artifacts/retreat-benchmark/screens/${project}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
  });
}
test.beforeEach(async ({ page, context, baseURL }) => {
  if (baseURL !== origin)
    throw new Error("Retreat tests require the isolated local application");
  execFileSync(process.env.E2E_PYTHON || "../.venv/bin/python", [
    "../scripts/seed-browser-fixtures.py",
  ]);
  fixture = JSON.parse(
    fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
  );
  await identity(context, "officer");
  event = await api(page, "/api/admin/events", "POST", {
    quarter_id: fixture.quarter.id,
    name: "Reservation test retreat",
    kind: "retreat",
    starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    ends_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    signup_cap_total: 1,
    activity_logging: true,
    general_signup_opens_at: new Date(Date.now() - 60000).toISOString(),
    questions: [
      {
        id: "required",
        label: "Emergency contact",
        kind: "text",
        required: true,
      },
      {
        id: "optional",
        label: "Anything else?",
        kind: "long",
        required: false,
      },
    ],
  });
  event = await api(page, `/api/admin/events/${event.id}/state`, "POST", {
    state: "published",
    expected_revision: event.revision,
  });
});

test("scheduled opening, optional questions, reservation, pending membership and original payment form", async ({
  page,
  context,
}, info) => {
  const write = Object.fromEntries(
    Object.keys(
      JSON.parse(fs.readFileSync("../backend/openapi.json", "utf8")).components
        .schemas["EventWrite-Input"].properties,
    )
      .filter((k) => k in event)
      .map((k) => [k, event[k]]),
  );
  event = await api(page, `/api/admin/events/${event.id}`, "PUT", {
    ...write,
    opens_at: new Date(Date.now() + 8000).toISOString(),
    general_signup_opens_at: new Date(Date.now() + 8000).toISOString(),
  });
  await api(
    page,
    `/api/admin/quarters/${fixture.quarter.id}/membership-signups`,
    "PUT",
    {
      membership_pause_starts_at: new Date(Date.now() - 60000).toISOString(),
      membership_pause_ends_at: new Date(Date.now() + 3600000).toISOString(),
      membership_pause_message: "Current members have first access to retreat.",
    },
  );
  await identity(context, "General Rider");
  const signals: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(`/events/${event.id}/activity`))
      signals.push(request.postDataJSON().action);
  });
  await page.goto(eventURL());
  await expect(
    page.getByText("General retreat signups open soon"),
  ).toBeVisible();
  await capture(page, info.project.name, "before-opening");
  await expect(
    page.getByText("Reserve first. Become a member after."),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Emergency contact")).toBeVisible();
  await expect(page.getByLabel("Anything else?")).toBeHidden();
  await expect(page.locator(".signup-membership-note")).toHaveCount(0);
  await capture(page, info.project.name, "signup");
  await page.getByRole("button", { name: "Sign me up!", exact: true }).click();
  await expect.poll(() => signals).toContain("validation_failed");
  await page.getByLabel("Emergency contact").fill("Test contact");
  await page.getByText("Other retreat questions (optional)").click();
  await page.getByLabel("Anything else?").fill("Optional answer");
  await capture(page, info.project.name, "optional-expanded");
  await page.getByRole("button", { name: "Sign me up!", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’re signed up!" }),
  ).toBeVisible();
  expect(signals).toContain("page_view");
  expect(signals.filter((s) => s === "signup_attempt").length).toBe(2);
  await capture(page, info.project.name, "reserved");
  const status = await api(
    page,
    `/api/me/memberships/${fixture.quarter.id}`,
    "GET",
    undefined,
    "General Rider",
  );
  expect(status.retreat_membership_required).toBe(true);
  expect(status.status).not.toBe("pending");
  await page.goto(`/my-aac/membership?quarter=${fixture.quarter.id}`);
  await expect(
    page.getByRole("heading", { name: "Pending membership", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".membership-details")).toContainText("Pending");
  await expect(page.locator(".personal-membership form")).toHaveCount(0);
  await expect(page.locator(".membership-pass")).toHaveCSS(
    "background-color",
    "rgb(255, 237, 184)",
  );
  await expect(
    page.getByRole("link", { name: "Go to Membership Signup" }),
  ).toHaveCSS("background-color", "rgb(255, 237, 184)");
  await capture(page, info.project.name, "pending-membership");
  await page.getByRole("link", { name: "Go to Membership Signup" }).click();
  await expect(
    page.getByText("Current members have first access to retreat."),
  ).toBeVisible();
  await expect(page.locator(".status-card form")).toHaveCount(0);
  await capture(page, info.project.name, "payments-paused");
  await api(
    page,
    `/api/admin/quarters/${fixture.quarter.id}/membership-signups`,
    "PUT",
    {
      membership_pause_starts_at: null,
      membership_pause_ends_at: null,
      membership_pause_message: "",
    },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Student · $25", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".status-card form .notice")).toContainText(
    "fixture@uci.edu",
  );
  await expect(page.locator(".zelle-recipient")).toHaveText(
    "Fixture Recipient",
  );
  await capture(page, info.project.name, "membership-zelle");
  await page.getByRole("radio", { name: /Venmo/ }).check();
  await expect(page.locator(".status-card form .notice")).toContainText(
    "@fixture-club",
  );
  await capture(page, info.project.name, "membership-venmo");
  await page.getByRole("radio", { name: "Cash at a meeting" }).check();
  await expect(page.locator(".status-card form .notice")).toContainText(
    "Tell the officer your name",
  );
  await page.getByLabel("I’ve sent my payment or paid an officer.").check();
  await page.getByRole("button", { name: /Submit for approval/ }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all set for now!" }),
  ).toBeVisible();
  await page.goto("/my-aac/signups");
  await expect(page.getByText("Dues awaiting officer approval")).toBeVisible();
});

test("last-place race gives the approved rejection and keeps the winning reservation", async ({
  page,
  context,
}, info) => {
  await identity(context, "General Rider");
  const snapshot = await api(page, `/api/events/${event.id}`);
  await page.route(`**/api/events/${event.id}`, (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.goto(eventURL());
  await page.getByLabel("Emergency contact").fill("Test contact");
  await api(
    page,
    `/api/events/${event.id}/signup`,
    "PUT",
    { role: "ride", answers: { required: "Winner contact" } },
    "Own Ride",
  );
  await page.getByRole("button", { name: "Sign me up!", exact: true }).click();
  await expect(page.getByText("Your spot wasn’t reserved")).toBeVisible();
  await expect(
    page.getByText(
      "The remaining places were taken before your signup was saved.",
    ),
  ).toBeVisible();
  expect(
    (
      await api(
        page,
        `/api/me/signups?event_id=${event.id}`,
        "GET",
        undefined,
        "General Rider",
      )
    ).items,
  ).toHaveLength(0);
  expect(
    (
      await api(
        page,
        `/api/me/signups?event_id=${event.id}`,
        "GET",
        undefined,
        "Own Ride",
      )
    ).items,
  ).toHaveLength(1);
  await capture(page, info.project.name, "lost-place");
});

test("officer settings keep logging compact at the bottom and available on other event kinds", async ({
  page,
}, info) => {
  await page.goto(`/admin/events/${event.slug}/${event.id}/edit`);
  await page.getByRole("tab", { name: "Signups & Carpools" }).click();
  await expect(
    page.getByLabel("Let general members reserve before becoming paid members"),
  ).toBeChecked();
  await expect(
    page.getByLabel("General members can sign up · Pacific"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage membership pause →" }),
  ).toHaveAttribute("href", `/admin/settings?quarter=${fixture.quarter.id}`);
  const logging = page.getByLabel("Log activity for this event", {
    exact: false,
  });
  await expect(logging).toBeChecked();
  await expect(
    page.getByText("Record views and signup activity in Server’s API logs."),
  ).toBeVisible();
  const logBox = await page.locator(".activity-logging-option").boundingBox();
  const saveBox = await page
    .getByRole("button", { name: "Save Changes", exact: true })
    .boundingBox();
  expect(logBox!.height).toBeLessThan(110);
  expect(logBox!.y).toBeLessThan(saveBox!.y);
  await capture(page, info.project.name, "officer-settings");
  const opening = page.getByLabel("General members can sign up · Pacific");
  const originalOpening = await opening.inputValue();
  await opening.fill("");
  await page.getByRole("tab", { name: "Basics", exact: true }).click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByText("Choose when general-member reservations open."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Signups & Carpools" }).click();
  await opening.fill(originalOpening);
  await logging.uncheck();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).not.toHaveURL(/\/edit$/);
  expect(
    (await api(page, `/api/admin/events/${event.id}`)).activity_logging,
  ).toBe(false);
  const regular = fixture.events.Adventure;
  await page.goto(`/admin/events/${regular.slug}/${regular.id}/edit`);
  await logging.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).not.toHaveURL(/\/edit$/);
  expect(
    (await api(page, `/api/admin/events/${regular.id}`)).activity_logging,
  ).toBe(true);
});
