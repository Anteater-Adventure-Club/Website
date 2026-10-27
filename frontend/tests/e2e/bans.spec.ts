import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const origin = "http://localhost:5173";
let fixture: any;
const dialog = (page: Page) => page.getByRole("dialog").last();
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
  data?: unknown,
  role = "officer",
) {
  const response = await page.request.fetch(url, {
    method,
    data,
    headers: { Origin: origin, Cookie: `aac_session=${fixture.cookies[role]}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function capture(page: Page, project: string, name: string) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const directory = path.resolve(
    `../artifacts/restrictions-and-bans/screens/${project}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.rmSync(path.join(directory, `${name}-bottom.png`), { force: true });
  const modal = page.getByRole("dialog").last();
  const hasModal = (await modal.count()) > 0;
  if (hasModal) {
    await modal.evaluate((e) => {
      e.scrollTop = 0;
    });
    if (
      project === "iphone" &&
      (await modal.evaluate((e) => e.classList.contains("ban-dialog")))
    ) {
      const box = await modal.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(12);
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        page.viewportSize()!.height - 12,
      );
      if (await modal.locator(".sticky-actions").count())
        await expect(modal.locator(".sticky-actions").last()).toHaveCSS(
          "position",
          "static",
        );
    }
  }
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: !hasModal,
    scale: "css",
  });
  if (
    hasModal &&
    (await modal.evaluate((e) => e.scrollHeight > e.clientHeight + 2))
  ) {
    await modal.evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    await page.screenshot({
      path: path.join(directory, `${name}-bottom.png`),
      fullPage: !hasModal,
      scale: "css",
    });
    await modal.evaluate((e) => {
      e.scrollTop = 0;
    });
  }
}
async function createEvent(
  page: Page,
  name: string,
  days: number,
  kind = "retreat",
) {
  const start = new Date(Date.now() + days * 86400000);
  const e = await api(page, "/api/admin/events", "POST", {
    quarter_id: fixture.quarter.id,
    name,
    kind,
    starts_at: start.toISOString(),
    ends_at: new Date(+start + 86400000).toISOString(),
    ...(kind === "retreat"
      ? { general_signup_opens_at: new Date(Date.now() - 60000).toISOString() }
      : {}),
  });
  return api(page, `/api/admin/events/${e.id}/state`, "POST", {
    state: "published",
  });
}
function pacificFuture(days: number) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Date.now() + days * 86400000));
  return parts.replace(" ", "T");
}

test.beforeEach(async ({ context, baseURL }) => {
  if (
    baseURL !== origin ||
    !(process.env.DATABASE_URL || "").includes("127.0.0.1:55432/aac_browser")
  )
    throw new Error("Ban tests require the isolated local browser database");
  execFileSync(process.env.E2E_PYTHON || "../.venv/bin/python", [
    "../scripts/seed-browser-fixtures.py",
  ]);
  fixture = JSON.parse(
    fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
  );
  await identity(context, "officer");
});

test("temporary ban, cancellation, general membership, member restrictions, and lifting", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const early = await createEvent(page, "Coastal Camping Retreat", 2);
  const later = await createEvent(page, "Next Month Retreat", 20);
  const hike = await createEvent(page, "Saturday Trail Walk", 3, "regular");
  const target = fixture.people.Pending;
  for (const event of [early, later, hike])
    await api(page, `/api/admin/events/${event.id}/signups`, "POST", {
      member_id: target.id,
      role: "own",
    });
  for (const [label, scope] of [
    ["Member", { event_ids: [hike.id] }],
    ["General Rider", { membership: true }],
  ] as const)
    await api(
      page,
      `/api/admin/members/${fixture.people[label].id}/bans`,
      "POST",
      {
        ...scope,
        reason: "Synthetic review example",
        message: "Contact officers to discuss your restriction.",
        request_id: randomUUID(),
      },
    );
  await page.goto("/admin/members");
  await page.getByLabel("Search members").fill("Fixture Pending");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "Ban Member", exact: true })
    .click();
  const categories = dialog(page).getByRole("group", {
    name: "Event categories",
  });
  await expect(
    dialog(page).getByRole("combobox", { name: "Event signups" }),
  ).toHaveCount(0);
  await dialog(page).getByLabel("Membership signups and new approvals").check();
  await categories
    .getByRole("button", { name: "Retreats", exact: true })
    .click();
  await categories
    .getByRole("button", { name: "Meetings", exact: true })
    .click();
  await expect(categories.getByRole("button", { pressed: true })).toHaveCount(
    2,
  );
  await categories.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    categories.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(categories.getByRole("button", { pressed: true })).toHaveCount(
    1,
  );
  await expect(
    dialog(page).getByLabel("Membership signups and new approvals"),
  ).toBeChecked();
  await categories
    .getByRole("button", { name: "Retreats", exact: true })
    .click();
  await expect(
    categories.getByRole("button", { name: "All", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await dialog(page).getByLabel("Ban ends · Pacific").fill(pacificFuture(7));
  await dialog(page)
    .getByLabel("Private officer reason")
    .fill("Private conduct review; never show this note to members.");
  await dialog(page)
    .getByLabel("Message for member (optional)")
    .fill(
      "Please contact the officer team before your next retreat or membership signup.",
    );
  const checkboxTargets = await dialog(page)
    .locator('input[type="checkbox"]')
    .evaluateAll((inputs) =>
      inputs.map((input) => ({
        width: input.getBoundingClientRect().width,
        height: input.closest("label")!.getBoundingClientRect().height,
      })),
    );
  expect(
    checkboxTargets.every(
      (target) => target.width >= 22 && target.height >= 44,
    ),
  ).toBe(true);
  await capture(page, info.project.name, "01-ban-form");
  await dialog(page)
    .getByRole("button", { name: "Review Ban", exact: true })
    .click();
  await expect(
    dialog(page).getByText("1 upcoming signup will be cancelled", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog(page).locator(".notice p")).toHaveCount(0);
  await expect(dialog(page).locator(".notice li")).toHaveCount(1);
  await capture(page, info.project.name, "02-cancellation-preview");
  await dialog(page)
    .getByRole("button", { name: "Confirm Ban", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    dialog(page).getByRole("button", { name: "Lift Ban", exact: true }),
  ).toBeVisible();
  await capture(page, info.project.name, "03-ban-history");
  await page.keyboard.press("Escape");
  await page.getByLabel("Search members").fill("");
  await page.getByRole("button", { name: "Banned", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Details", exact: true }),
  ).toHaveCount(3);
  await expect(
    page
      .locator(".record-table")
      .getByRole("button", { name: /Ban Member|Manage Bans/ }),
  ).toHaveCount(0);
  await expect(page.locator('td[data-label="Member"] .pill')).toHaveCount(0);
  await expect(
    page
      .locator('td[data-label="Membership"] .pill')
      .filter({ hasText: /^Temp banned$/ }),
  ).toHaveCount(1);
  await expect(
    page
      .locator('td[data-label="Membership"] .pill')
      .filter({ hasText: /^Banned$/ }),
  ).toHaveCount(2);
  await capture(page, info.project.name, "04-banned-members");
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Banned", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Confirm Dues", exact: true }),
  ).toHaveCount(1);
  await capture(page, info.project.name, "05-member-actions");
  await page.getByRole("button", { name: "Confirm Dues", exact: true }).click();
  await expect(
    dialog(page).getByRole("option", {
      name: "Reject submission",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog(page).getByLabel("Membership category").selectOption("general");
  await dialog(page)
    .getByLabel("Notes / reason")
    .fill("Pending submission reviewed by officers.");
  await capture(page, info.project.name, "06-return-to-general");
  await dialog(page)
    .getByRole("button", { name: "Save Adjustment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const history = await api(page, `/api/admin/members/${target.id}`);
  expect(history.membership.status).toBe("general");
  expect(
    history.signups.find((s: any) => s.event_id === early.id).cancelled,
  ).toBe(true);
  for (const event of [later, hike])
    expect(
      history.signups.find((s: any) => s.event_id === event.id).cancelled,
    ).toBe(false);
  await identity(context, "Pending");
  await page.goto("/my-aac");
  await expect(page.getByLabel("Signup restrictions").first()).toBeVisible();
  await capture(page, info.project.name, "07-my-aac-restrictions");
  await page.goto(`/events/${early.slug}/${early.id}`);
  await expect(page.getByLabel("Signup restrictions")).toBeVisible();
  await capture(page, info.project.name, "08-event-restriction");
  expect(await page.locator("body").innerText()).not.toMatch(
    /\bban(?:ned|s)?\b|Private conduct review/i,
  );
  const denied = await page.request.put(`/api/events/${early.id}/signup`, {
    data: { role: "own" },
    headers: { Origin: origin },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/membership");
  await expect(page.getByLabel("Signup restrictions")).toBeVisible();
  await expect(
    page.getByText("Membership submission not approved", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Pending submission reviewed by officers.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Submit for approval/ }),
  ).toHaveCount(0);
  await capture(page, info.project.name, "09-membership-restriction");
  await page.goto("/my-aac/membership");
  await expect(page.getByLabel("Signup restrictions")).toBeVisible();
  await expect(
    page.getByText("Membership submission not approved", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Pending submission reviewed by officers.", { exact: true }),
  ).toHaveCount(0);
  await capture(page, info.project.name, "10-membership-decision");
  await expect(page.locator(".membership-pass .pill")).toHaveText(
    "General member",
  );
  await page.goto("/my-aac/profile");
  await expect(
    page.getByRole("heading", { name: /Profile/ }).first(),
  ).toBeVisible();
  await identity(context, "officer");
  await page.goto("/admin/members?ban_status=active");
  await page
    .getByRole("row")
    .filter({ hasText: "Fixture Pending" })
    .getByRole("button", { name: "Details", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Lift Ban", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Private reason for lifting")
    .fill("Review completed.");
  await dialog(page).getByRole("button", { name: "Confirm Lift" }).click();
  await expect(dialog(page).getByText("Lifted", { exact: true })).toBeVisible();
  await capture(page, info.project.name, "11-lifted-ban");
  await identity(context, "Pending");
  await page.goto(`/events/${early.slug}/${early.id}`);
  await expect(page.locator(".signup-panel")).toBeVisible();
  await expect(page.getByLabel("Signup restrictions")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("permanent specific-event ban leaves other events and membership available", async ({
  page,
  context,
}, info) => {
  const event = await createEvent(page, "One Event Only", 3, "regular");
  const target = fixture.people["General Rider"];
  await page.goto("/admin/members");
  await page.getByLabel("Search members").fill(target.name);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "Ban Member", exact: true })
    .click();
  await dialog(page)
    .getByText("Choose specific events (optional)", { exact: true })
    .click();
  await dialog(page).getByLabel("Search specific events").fill(event.name);
  await dialog(page)
    .getByRole("checkbox", { name: new RegExp(event.name) })
    .check();
  await dialog(page)
    .getByLabel(/^Duration/)
    .selectOption("permanent");
  await dialog(page)
    .getByLabel("Private officer reason")
    .fill("Specific-event fixture review.");
  await capture(page, info.project.name, "12-permanent-specific-event");
  await dialog(page)
    .getByRole("button", { name: "Review Ban", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Confirm Ban", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    dialog(page).getByRole("button", { name: "Lift Ban", exact: true }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".record-table .pill").getByText("Banned", { exact: true }),
  ).toBeVisible();
  await identity(context, "General Rider");
  await page.goto(`/events/${event.slug}/${event.id}`);
  await expect(page.getByLabel("Signup restrictions")).toBeVisible();
  await page.goto("/membership");
  await expect(
    page.getByLabel("What’s your contact phone number?"),
  ).toBeVisible();
  const other = await createEvent(page, "Unaffected Event", 4, "regular");
  await api(
    page,
    `/api/events/${other.id}/signup`,
    "PUT",
    { role: "own" },
    "General Rider",
  );
});

test("an open member page refreshes at temporary expiry", async ({
  page,
  context,
}) => {
  const event = await createEvent(page, "Expiry Check Walk", 3, "regular");
  const member = fixture.people["General Rider"];
  await api(page, `/api/admin/members/${member.id}/bans`, "POST", {
    event_ids: [event.id],
    expires_at: new Date(Date.now() + 8000).toISOString(),
    reason: "Short-lived expiry fixture",
    request_id: randomUUID(),
  });
  await identity(context, "General Rider");
  await page.goto(`/events/${event.slug}/${event.id}`);
  await expect(page.getByLabel("Signup restrictions")).toBeVisible();
  await expect(page.getByLabel("Signup restrictions")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator(".signup-panel")).toBeVisible();
  await api(
    page,
    `/api/events/${event.id}/signup`,
    "PUT",
    { role: "own" },
    "General Rider",
  );
});
