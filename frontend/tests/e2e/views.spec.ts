import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
const fixtures = JSON.parse(
  fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
);
const event = (name: string, admin = false) =>
  `${admin ? "/admin" : ""}/events/${fixtures.events[name].slug}/${fixtures.events[name].id}`;
type Case = {
  id: string;
  route: string;
  role?: string;
  open?: (page: any) => Promise<void>;
};
const cases: Case[] = [
  { id: "5a-5b-home", route: "/" },
  { id: "1b-4c-calendar", route: "/events" },
  { id: "4b-8d-board", route: "/board" },
  { id: "3f-signin", route: "/sign-in" },
  { id: "8f-404", route: "/off-the-trail" },
  { id: "3b-8a-public-membership", route: "/membership" },
  { id: "3b-general-membership", route: "/membership", role: "General Rider" },
  { id: "3c-pending-membership", route: "/membership", role: "Pending" },
  { id: "8a-paid-membership", route: "/membership", role: "Member" },
  { id: "8a-exception-membership", route: "/membership", role: "Exception" },
  { id: "1e-8b-event", route: event("Adventure") },
  { id: "1f-not-open", route: event("Not Open"), role: "Member" },
  { id: "1f-closed", route: event("Closed"), role: "Member" },
  { id: "8c-cancelled", route: event("Cancelled"), role: "Member" },
  { id: "1f-completed", route: event("Completed"), role: "Member" },
  { id: "1f-driver", route: event("Multi-day"), role: "Driver" },
  { id: "1h-checkedin", route: event("Field"), role: "Paid Rider" },
  {
    id: "1g-driver-signup",
    route: event("Adventure"),
    role: "Driver",
    open: async (p) => {
      await p.getByRole("button", { name: "I can drive others!" }).click();
    },
  },
  { id: "3a-member-overview", route: "/my-aac", role: "Member" },
  { id: "3d-8e-profile", route: "/my-aac/profile", role: "Driver" },
  { id: "3e-signups", route: "/my-aac/signups", role: "Member" },
  {
    id: "1p-own-reimbursements",
    route: "/my-aac/reimbursements",
    role: "Driver",
  },
  { id: "8g-denied", route: "/admin/overview", role: "Member" },
  {
    id: "3g-7a-dashboard",
    route: "/admin/overview",
    role: "officer",
    open: async (p) => {
      const response = await p.request.get(
        `/api/admin/overview?quarter_id=${fixtures.quarter.id}`,
      );
      expect(response.ok()).toBeTruthy();
      const stats = (await response.json()).statistics;
      const quarterly = p.locator(".stat-grid .panel").filter({
        has: p.getByText("Quarterly members", { exact: true }),
      });
      await expect(quarterly.locator("strong")).toHaveText(
        String(stats.quarter_members),
      );
      await expect(quarterly).toContainText(
        "Signed up for at least one event this quarter, including cancellations and no-shows.",
      );
      await expect(p.locator(".page-heading")).toContainText(
        `Lifetime members: ${stats.members}`,
      );
      await expect(p.locator(".stat-grid .panel")).toHaveCount(4);
      await p
        .getByRole("combobox", { name: "Selected quarter" })
        .selectOption(String(fixtures.past.id));
      await expect(p.locator(".page-heading")).toContainText(
        fixtures.past.name,
      );
      await expect(quarterly.locator("strong")).toHaveText("0");
      await expect(p.locator(".page-heading")).toContainText(
        `Lifetime members: ${stats.members}`,
      );
      await p
        .getByRole("combobox", { name: "Selected quarter" })
        .selectOption(String(fixtures.quarter.id));
      await expect(quarterly.locator("strong")).toHaveText(
        String(stats.quarter_members),
      );
    },
  },
  { id: "3h-7b-events", route: "/admin/events", role: "officer" },
  { id: "3i-signups", route: event("Field", true), role: "officer" },
  {
    id: "6a-6j-carpools",
    route: event("Field", true) + "?tab=carpools",
    role: "officer",
  },
  {
    id: "6b-log",
    route: event("Field", true) + "?tab=check-in-log",
    role: "officer",
  },
  {
    id: "6b-questions",
    route: event("Field", true) + "?tab=questions",
    role: "officer",
  },
  {
    id: "1m-trips",
    route: event("Field", true) + "?tab=trips",
    role: "officer",
  },
  {
    id: "1d-recap",
    route: event("Completed", true) + "?tab=recap",
    role: "officer",
  },
  { id: "2a-basics", route: "/admin/events/new", role: "officer" },
  {
    id: "2b-signups-editor",
    route: "/admin/events/new",
    role: "officer",
    open: async (p) => {
      await p.getByRole("tab", { name: "Signups & Carpools" }).click();
    },
  },
  {
    id: "2c-alternating",
    route: `/admin/series/${fixtures.series.id}/edit`,
    role: "officer",
  },
  { id: "3j-7c-members", route: "/admin/members", role: "officer" },
  {
    id: "7d-dues",
    route: "/admin/members?status=pending",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Confirm Dues" }).first().click();
    },
  },
  {
    id: "7e-details",
    route: "/admin/members",
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: "Details", exact: true })
        .first()
        .click();
    },
  },
  {
    id: "3k-import",
    route: "/admin/members",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Import", exact: true }).click();
    },
  },
  { id: "3m-settings", route: "/admin/settings", role: "officer" },
  {
    id: "8h-new-quarter",
    route: "/admin/settings",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "New Quarter" }).click();
    },
  },
  { id: "3n-picker", route: "/admin/check-in", role: "officer" },
  { id: "1i-desk", route: event("Field", true) + "/check-in", role: "officer" },
  {
    id: "1j-card-preview",
    route: event("Field", true) + "/check-in",
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: /Fixture Member Paid Member/ })
        .click();
    },
  },
  {
    id: "1j-arrived",
    route: event("Field", true) + "/check-in",
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: /Fixture Paid Rider Paid Member/ })
        .click();
    },
  },
  {
    id: "6e-extension",
    route: event("Field", true) + "/check-in",
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: /Fixture Late Rider General Member/ })
        .click();
      await p
        .getByRole("button", { name: "Hold Their Seat a Little Longer" })
        .click();
    },
  },
  {
    id: "6f-cards",
    route: event("Field", true) + "/check-in",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Cards", exact: true }).click();
    },
  },
  {
    id: "1l-walkin",
    route: event("Field", true) + "/check-in",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Walk-in", exact: true }).click();
      await p.getByRole("button", { name: "Enter a New Person" }).click();
    },
  },
  { id: "1k-seat", route: event("Field", true) + "/seat", role: "officer" },
  { id: "1n-quarter-close", route: "/admin/reimbursements", role: "officer" },
  {
    id: "10b-driver-register",
    route: "/admin/reimbursements",
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: "Register Driver", exact: true })
        .first()
        .click();
    },
  },
  {
    id: "6g-finalize",
    route: "/admin/reimbursements",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: /4\s*Review/ }).click();
      await p.getByRole("button", { name: "Finalize Quarter" }).click();
    },
  },
  {
    id: "6h-payments",
    route: `/admin/reimbursements?quarter=${fixtures.finalized.id}`,
    role: "officer",
  },
  {
    id: "1o-payment",
    route: `/admin/reimbursements?quarter=${fixtures.finalized.id}`,
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Mark Paid", exact: true }).click();
    },
  },
  {
    id: "6i-archive-empty",
    route: `/admin/reimbursements?quarter=${fixtures.past.id}`,
    role: "officer",
  },
  { id: "9a-board-admin", route: "/admin/officers", role: "officer" },
  {
    id: "9a-board-editor",
    route: "/admin/officers",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Edit Profile" }).first().click();
    },
  },
  {
    id: "7f-revoke",
    route: "/admin/officers",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Revoke Access" }).last().click();
    },
  },
  {
    id: "6c-complete",
    route: event("Field", true),
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: "Complete Event", exact: true })
        .click();
    },
  },
  {
    id: "6c-cancel",
    route: event("Adventure", true),
    role: "officer",
    open: async (p) => {
      await p
        .getByRole("button", { name: "Cancel Event", exact: true })
        .click();
    },
  },
  {
    id: "10a-account",
    route: "/my-aac",
    role: "officer",
    open: async (p) => {
      await p.getByRole("button", { name: "Open account menu" }).click();
    },
  },
];
for (const c of cases)
  test(c.id, async ({ page, context }, info) => {
    if (c.role)
      await context.addCookies([
        {
          name: "aac_session",
          value: fixtures.cookies[c.role],
          domain: "localhost",
          path: "/",
        },
      ]);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(c.route);
    await page.locator("h1,h2").first().waitFor();
    await page
      .getByRole("status", { name: "Loading" })
      .waitFor({ state: "hidden" })
      .catch(() => {});
    if (c.open) await c.open(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).not.toContainText(
      "This record could not be found.",
    );
    await expect(page.locator("body")).not.toContainText("A little detour");
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      body: document.documentElement.scrollWidth,
    }));
    expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width + 1,
    );
    expect(errors).toEqual([]);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => {
              const rect = img.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
            })
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.getAttribute("src")),
        ),
      )
      .toEqual([]);
    const directory = path.resolve(
      `../artifacts/viewports/${info.project.name}`,
    );
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/${c.id}.png`, fullPage: true });
    if (info.project.name === "chromium-390") {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const serious = result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      );
      expect(
        serious.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
    }
  });
