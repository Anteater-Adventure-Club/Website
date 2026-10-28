import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const member = {
  id: 2,
  name: "Guest Helper",
  email: "helper@example.com",
  phone: "9495550100",
  approval_status: "approved",
  pronouns: "",
  discord: "",
  can_drive: false,
  student: false,
  driving_preferences: "",
  payout_method: "",
  payout_destination: "",
  payout_phone_suffix: "",
};
const quarter = {
  id: 1,
  name: "Test quarter",
  starts_on: "2020-01-01",
  ends_on: "2099-12-31",
  state: "open",
  mpg: "25",
  budget: "100",
  driver_cap: "0",
  reimbursement_data_available: true,
};
const event = {
  id: 42,
  slug: "club-hike",
  name: "Club hike",
  quarter_id: 1,
  series_id: null,
  revision: 1,
  starts_at: "2099-11-10T17:00:00Z",
  ends_at: "2099-11-10T23:00:00Z",
  destination: "Trail",
  state: "published",
  signups_enabled: true,
  kind: "regular",
  questions: [],
  packing: [],
  signup_count: 0,
  paid_riders: 0,
  offered_seats: 0,
  signup_counts_by_role: { own: 0, ride: 0, driver: 0 },
  signup_status: "open",
  signup_cap_total: null,
  signup_cap_ride: null,
  signup_cap_driver: null,
  signup_cap_own: null,
  photo_id: null,
  description: "",
  completion: null,
  has_signups: false,
  miles: "10",
  gas_price: "4",
  rate: "0.16",
  rate_override: null,
};
async function fixture(page: Page, permissions: string[], full = false) {
  const state = {
    permissions,
    full,
    expiry: new Date(Date.now() + 86400000).toISOString(),
    grants: [] as any[],
    requests: [] as string[],
    writes: [] as any[],
    errors: [] as string[],
  };
  page.on("pageerror", (e) => state.errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    state.requests.push(path);
    const method = request.method();
    let json: any = {};
    if (path === "/api/session")
      json = {
        member: {
          ...member,
          ...(state.full ? { id: 1, name: "Full Officer" } : {}),
        },
        officer: state.full,
        oauth_available: true,
        profile_complete: true,
        officer_access: {
          kind: state.full
            ? "full"
            : state.permissions.length &&
                new Date(state.expiry).getTime() > Date.now()
              ? "guest"
              : "none",
          permissions: state.permissions,
          expires_at: state.full ? null : state.expiry,
        },
        server_time: new Date().toISOString(),
      };
    else if (path === "/api/quarters" || path === "/api/admin/quarters")
      json = { items: [quarter], total: 1 };
    else if (path === "/api/admin/events")
      json = {
        items: [
          event,
          { ...event, id: 43, name: "Second date", series_id: 7 },
          { ...event, id: 44, name: "Third date", series_id: 7 },
        ],
        total: 3,
      };
    else if (/^\/api\/admin\/events\/\d+$/.test(path)) json = event;
    else if (
      path.endsWith("/signups") ||
      path.endsWith("/trips") ||
      path.endsWith("/check-in-log")
    )
      json = { items: [], total: 0 };
    else if (path.endsWith("/recap"))
      json = {
        event_id: 42,
        draft: {},
        published: null,
        completion: null,
        has_signups: false,
        revision: 0,
      };
    else if (path === "/api/admin/board/terms")
      json = {
        items: [
          {
            id: 1,
            label: "Current board",
            start_year: 2026,
            current: true,
            revision: 1,
          },
        ],
      };
    else if (path === "/api/admin/board/terms/1")
      json = {
        term: {
          id: 1,
          label: "Current board",
          start_year: 2026,
          current: true,
          revision: 1,
        },
        entries: [],
      };
    else if (path === "/api/admin/officers")
      json = {
        items: [
          {
            member_id: 1,
            name: "Full Officer",
            email: "officer@uci.edu",
            granted_at: "2026-01-01T00:00:00Z",
          },
        ],
      };
    else if (
      path === "/api/admin/member-lookup" ||
      path === "/api/admin/members"
    )
      json = {
        items: [
          {
            member,
            membership: null,
            bans: [],
            application_submitted_at: null,
          },
        ],
        total: 1,
        quarter_id: 1,
      };
    else if (path === "/api/admin/members/2")
      json = {
        member,
        membership: null,
        bans: [],
        memberships: [],
        signups: [],
        officer: false,
      };
    else if (path === "/api/admin/members/2/application")
      json = { status: "approved", previous_applications: [] };
    else if (path === "/api/admin/quarters/1/reimbursements")
      json = {
        quarter_id: 1,
        state: "open",
        reimbursement_data_available: true,
        budget: "100",
        driver_cap: "0",
        coverage: "1",
        totals: { nominal: "0", allocated: "0", pending: "0", paid: "0" },
        drivers: [],
        events: [],
      };
    else if (path === "/api/me/overview")
      json = { quarter_id: 1, membership: null, next_event: null, signups: [] };
    else if (path === "/api/me/restrictions") json = { items: [] };
    else if (path.startsWith("/api/me/memberships/"))
      json = { status: "general" };
    else if (path.startsWith("/api/admin/guest-officers")) {
      if (method === "POST" || method === "PUT") {
        const body = request.postDataJSON();
        state.writes.push(body);
        const grant = {
          ...body,
          member_id: 2,
          name: member.name,
          email: member.email,
          revision: (state.grants[0]?.revision || 0) + 1,
          granted_by: 1,
          updated_by: 1,
          granted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active: true,
        };
        state.grants = [grant];
        json = grant;
      } else if (method === "DELETE") {
        state.grants = [];
        json = { ok: true };
      } else json = { items: state.grants };
    }
    await route.fulfill({ json });
  });
  return state;
}

async function visibleTabs(page: Page) {
  const picker = page.locator(".section-picker");
  if (await picker.isVisible()) {
    await picker.click();
    const dialog = page.getByRole("dialog", {
      name: "Officer Tools",
      exact: true,
    });
    const labels = await dialog.getByRole("link").allTextContents();
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    return labels;
  }
  return page
    .getByRole("navigation", { name: "Officer sections", exact: true })
    .getByRole("link")
    .allTextContents();
}

for (const [permission, path, tabs] of [
  ["events", "/admin/events", ["Events"]],
  ["participation", "/admin/events", ["Events", "Check In"]],
  ["members", "/admin/members", ["Members"]],
  ["reimbursements", "/admin/reimbursements", ["Events", "Reimbursements"]],
  ["board", "/admin/officers", ["Officers"]],
] as const) {
  test(`${permission} only shows useful tabs and actions`, async ({ page }) => {
    const state = await fixture(page, [permission]);
    await page.goto(path);
    await expect(page.getByText(/Guest access · expires/)).toBeVisible();
    expect(await visibleTabs(page)).toEqual(tabs);
    if (
      permission === "events" ||
      permission === "participation" ||
      permission === "reimbursements"
    ) {
      if (permission === "participation")
        await expect(
          page.getByRole("heading", { name: "Third date" }),
        ).toBeVisible();
      await page.goto("/admin/events/club-hike/42?tab=google-sheets");
      const expected =
        permission === "events"
          ? ["Recap"]
          : permission === "participation"
            ? ["Signups", "Carpools", "Check-in Log", "Questions"]
            : ["Trips & Mileage"];
      await expect(
        page
          .getByRole("navigation", { name: "Event management tabs" })
          .getByRole("button"),
      ).toHaveText(expected);
      await expect(
        page.getByRole("link", { name: "Edit This Date" }),
      ).toHaveCount(permission === "events" ? 1 : 0);
      expect(state.requests).not.toContain("/api/admin/events/42/google-sheet");
      if (permission !== "reimbursements")
        expect(state.requests).not.toContain("/api/admin/events/42/trips");
      if (permission !== "events")
        expect(state.requests).not.toContain("/api/admin/events/42/recap");
    }
    if (permission === "members") {
      await page.getByRole("button", { name: "Details", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Record / Correct Dues" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Ban Member" }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Reimbursement destination · private"),
      ).toHaveCount(0);
      expect(state.requests).not.toContain("/api/admin/members/2/bans");
    }
    if (permission === "board") {
      await expect(
        page.getByRole("heading", { name: "Officer site access" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Grant Guest Access" }),
      ).toHaveCount(0);
      expect(state.requests).not.toContain("/api/admin/officers");
      expect(state.requests).not.toContain("/api/admin/guest-officers");
      await page
        .getByRole("button", { name: "Add Board Profile", exact: true })
        .first()
        .click();
      await expect(page.getByLabel("Grant officer site access")).toHaveCount(0);
    }
    if (permission === "events") {
      await page.goto("/admin/events/club-hike/42/edit");
      await expect(
        page.getByLabel("Event name", { exact: true }),
      ).toBeVisible();
      expect(state.requests).not.toContain("/api/admin/events/42/signups");
    }
    await page.goto("/admin/settings");
    await expect(page).not.toHaveURL(/\/admin\/settings/);
    expect(state.errors).toEqual([]);
  });
}

test("full officers grant, edit, renew and revoke Guest access", async ({
  page,
}) => {
  const state = await fixture(page, [], true);
  await page.goto("/admin/officers");
  await page.getByRole("button", { name: "Grant Guest Access" }).click();
  await page.getByLabel("Find an existing member").fill("Guest");
  await page.getByRole("button", { name: /Guest Helper/ }).click();
  await page.getByLabel("Check-in & Carpools", { exact: true }).check();
  const expiry = page.getByLabel("Access expires · Pacific");
  expect(await expiry.inputValue()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await page.getByRole("button", { name: "Save Guest Access" }).click();
  await expect(page.getByRole("button", { name: "Edit Access" })).toBeVisible();
  expect(state.writes[0].permissions).toEqual(["participation"]);
  expect(
    new Date(state.writes[0].expires_at).getTime() - Date.now(),
  ).toBeGreaterThan(6 * 86400000);
  await page.getByRole("button", { name: "Edit Access" }).click();
  await page.getByLabel("Members & Dues", { exact: true }).check();
  const audit = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations.map((v) => v.id)).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("guest-permissions.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save Guest Access" }).click();
  await expect(page.getByRole("button", { name: "Edit Access" })).toBeVisible();
  expect(state.writes[1]).toMatchObject({
    expected_revision: 1,
    permissions: ["participation", "members"],
  });
  state.grants[0].active = false;
  state.grants[0].expires_at = "2020-01-01T00:00:00Z";
  await page.reload();
  await page.getByRole("button", { name: "Renew Access" }).click();
  await page.getByRole("button", { name: "Save Guest Access" }).click();
  await expect(page.getByRole("button", { name: "Edit Access" })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Guest Access" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Revoke Access", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No Guest officers" }),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
});

for (const reason of ["expiry", "revocation", "permission change"] as const) {
  test(`an open page responds to ${reason} without retaining privileged content`, async ({
    page,
  }) => {
    const state = await fixture(page, ["members"]);
    if (reason === "expiry")
      state.expiry = new Date(Date.now() + 4000).toISOString();
    await page.goto("/admin/members");
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    if (reason !== "expiry") {
      state.permissions = reason === "permission change" ? ["board"] : [];
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }
    await expect(page).toHaveURL(
      reason === "permission change" ? /\/admin\/officers/ : /\/my-aac$/,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name:
          reason === "permission change" ? "Officers & Board" : "Hi, Guest!",
        exact: true,
      }),
    ).toBeVisible();
    if (reason === "permission change") {
      await expect(
        page.getByRole("heading", { name: "No profiles in this board yet" }),
      ).toBeVisible();
    }
    await page.goto("/admin/members");
    await expect(page).not.toHaveURL(/\/admin\/members/);
    expect(state.errors).toEqual([]);
  });
}
