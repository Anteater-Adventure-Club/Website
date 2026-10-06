// Refresh the README images after following docs/local-previews.md.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, "../../..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium, expect } = require("@playwright/test");
const origin = "http://localhost:5173";
const fixtures = JSON.parse(
  await fs.readFile(path.join(root, "artifacts/browser-fixtures.json"), "utf8"),
);
assert(fixtures.quarter.name.startsWith("Fixture"), "Use synthetic fixtures");
assert(
  Date.now() - Date.parse(fixtures.created_at) < 8 * 60 * 60 * 1000,
  "Fixture sessions expired; stop the fixture API and reseed",
);
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const field = fixtures.events.Field;
const captures = [
  { name: "home", route: "/" },
  { name: "about", route: "/", scroll: ".activities" },
  { name: "events", route: "/events", scroll: ".calendar-panel", top: 120 },
  { name: "board", route: "/board" },
  { name: "membership", route: "/membership" },
  { name: "my-aac", route: "/my-aac", role: "Member" },
  { name: "officer-dashboard", route: "/admin/overview", role: "officer" },
  {
    name: "mobile-membership",
    route: "/my-aac/membership",
    role: "Member",
    viewport: phone,
  },
  {
    name: "mobile-check-in",
    route: `/admin/events/${field.slug}/${field.id}/check-in`,
    role: "officer",
    viewport: phone,
  },
];

const browser = await chromium.launch();
const report = [];
try {
  for (const capture of captures) {
    const viewport = capture.viewport || desktop;
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    if (capture.role) {
      await context.addCookies([
        {
          name: "aac_session",
          value: fixtures.cookies[capture.role],
          domain: "localhost",
          path: "/",
        },
      ]);
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + capture.route);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(origin + capture.route);
    await expect(page.locator("body")).not.toContainText("A little detour");
    if (capture.role) {
      const session = await context.request.get(origin + "/api/session");
      const identity = await session.json();
      assert(identity.member, "Expected a signed-in fixture account");
      if (capture.role === "officer") assert(identity.officer);
    }
    if (capture.scroll) {
      await page.locator(capture.scroll).evaluate((element, top) => {
        window.scrollTo(0, element.getBoundingClientRect().top + scrollY - top);
      }, capture.top || 24);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() =>
      Array.from(document.images).every((img) => {
        const rect = img.getBoundingClientRect();
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight;
        return !visible || (img.complete && img.naturalWidth > 0);
      }),
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Horizontal overflow",
    );
    assert.deepEqual(errors, [], "Browser page errors");
    const filename = capture.name + ".jpg";
    await page.screenshot({
      path: path.join(output, filename),
      type: "jpeg",
      quality: 88,
      animations: "disabled",
    });
    report.push({
      file: filename,
      route: capture.route,
      role: capture.role || "anonymous",
      viewport,
      pageErrors: errors,
    });
    console.log(filename);
    await context.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  path.join(root, "artifacts/readme-captures.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      fixtureCreatedAt: fixtures.created_at,
      captures: report,
    },
    null,
    2,
  ) + "\n",
);
