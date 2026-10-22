import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("officers configure event columns and manage sync across screen sizes", async ({
  page,
}, info) => {
  const catalog = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "status", header: "Signup status" },
    { key: "question:activities", header: "Activities" },
  ];
  let sheet = {
    configured: false,
    enabled: false,
    revision: null as number | null,
    columns: catalog,
    catalog,
    spreadsheet_url: null as string | null,
    status: "not_configured",
    last_synced_at: null,
    pending_since: null,
    error: "",
    sharing_pending: false,
    sharing_error: "",
    preview: [
      ["Alex", "alex@example.com", "Cancelled", "Hiking\nPicnic, games"],
    ],
  };
  let connected = true;
  const writes: any[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (pathname === "/api/session")
      json = {
        member: {
          id: 1,
          name: "Synthetic Officer",
          email: "officer@example.com",
          phone: "9495550100",
        },
        officer: true,
        oauth_available: true,
        profile_complete: true,
      };
    if (pathname === "/api/admin/quarters" || pathname === "/api/quarters")
      json = {
        items: [
          {
            id: 1,
            name: "Test quarter",
            state: "open",
            starts_on: "2026-09-01",
            ends_on: "2026-12-30",
          },
        ],
        total: 1,
      };
    if (pathname === "/api/admin/events/42")
      json = {
        id: 42,
        slug: "test-hike",
        name: "Test hike",
        quarter_id: 1,
        series_id: null,
        revision: 1,
        starts_at: "2026-11-10T17:00:00Z",
        ends_at: "2026-11-10T23:00:00Z",
        destination: "Test trail",
        state: "published",
        signups_enabled: true,
        kind: "regular",
        questions: [],
        packing: [],
      };
    if (pathname === "/api/admin/integrations/google-sheets") {
      if (route.request().method() === "DELETE") connected = false;
      json = {
        available: true,
        connected,
        email: "club@example.com",
        error: "",
        worker_healthy: true,
        worker_seen_at: "2026-10-19T18:00:00Z",
        pending_count: 0,
        oldest_pending_at: null,
      };
    }
    if (pathname === "/api/admin/events/42/google-sheet") {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        writes.push(body);
        sheet = {
          ...sheet,
          configured: true,
          enabled: body.enabled,
          columns: body.columns,
          revision: (sheet.revision || 0) + 1,
          status: body.enabled ? "pending" : "paused",
          spreadsheet_url:
            "https://docs.google.com/spreadsheets/d/synthetic/edit",
        };
      }
      json = sheet;
    }
    if (pathname === "/api/admin/events/42/google-sheet/sync") {
      sheet = {
        ...sheet,
        status: "retrying",
        error:
          "Google is busy or unavailable. Updates will retry automatically.",
      };
      json = sheet;
    }
    await route.fulfill({ json });
  });
  await page.goto("/admin/events/test-hike/42?tab=google-sheets");
  await expect(
    page.getByRole("heading", { name: "Event spreadsheet" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Email", exact: true }).uncheck();
  await page.getByLabel("Heading for Activities").fill("Plans");
  await page.getByRole("button", { name: "Move Activities up" }).click();
  await expect(page.getByRole("columnheader")).toHaveText([
    "Name",
    "Plans",
    "Signup status",
  ]);
  await page.getByRole("button", { name: "Create spreadsheet" }).click();
  await expect(
    page.getByRole("link", { name: "Open spreadsheet" }),
  ).toBeVisible();
  expect(writes[0]).toEqual({
    enabled: true,
    expected_revision: null,
    columns: [
      catalog[0],
      { key: "question:activities", header: "Plans" },
      catalog[2],
    ],
  });
  await page.getByRole("button", { name: "Pause sync" }).click();
  await expect(page.getByRole("button", { name: "Sync now" })).toBeDisabled();
  await page.getByRole("button", { name: "Resume sync" }).click();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page.getByText(
      "Google is busy or unavailable. Updates will retry automatically.",
    ),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const accessibility = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("google-sheets.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Disconnect club account" }).click();
  await expect(page.getByRole("dialog")).toContainText("every event");
  await page.getByRole("button", { name: "Disconnect all events" }).click();
  await expect(
    page.getByRole("button", { name: "Save column settings" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
