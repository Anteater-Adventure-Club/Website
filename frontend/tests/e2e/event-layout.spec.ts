import { test, expect } from "@playwright/test";
import type { Event } from "../../src/lib/api";

const trailURL =
  "https://www.alltrails.com/explore/trail/us/california/borrego-canyon-to-red-rock-canyon--2";

for (const photo of [false, true]) {
  test(`event description with a long URL fits the viewport ${photo ? "with" : "without"} a photo`, async ({
    page,
  }, info) => {
    const event: Event = {
      id: 42,
      slug: "red-rock-canyon-hike-week-2",
      quarter_id: 14,
      series_id: null,
      name: "Red Rock Canyon Hike (Week 2)",
      kind: "regular",
      destination: "Whiting Ranch",
      description: `Join AAC this Saturday for a hike to Red Rock Canyon!\n\nBring water and comfortable shoes. Meet at the flagpoles for your ride.\n\n${trailURL}`,
      starts_at: "2026-10-10T17:30:00Z",
      ends_at: "2026-10-10T22:30:00Z",
      state: "published",
      signups_enabled: true,
      opens_at: null,
      closes_at: null,
      arrival_at: "2026-10-10T17:30:00Z",
      departure_at: "2026-10-10T18:00:00Z",
      return_at: "2026-10-10T22:30:00Z",
      packing: ["water", "snacks", "hiking shoes"],
      questions: [],
      photo_id: photo ? "fixture-photo" : null,
      cancellation_reason: "",
      signup_status: "open",
      signup_count: 56,
      offered_seats: 37,
      paid_riders: 7,
      paid_ride_guaranteed: true,
      published_recap: null,
    };
    await page.route("**/api/session", (route) =>
      route.fulfill({
        json: {
          member: null,
          officer: false,
          oauth_available: true,
          profile_complete: false,
        },
      }),
    );
    await page.route("**/api/quarters?*", (route) =>
      route.fulfill({ json: { items: [], total: 0 } }),
    );
    await page.route("**/api/site-settings", (route) =>
      route.fulfill({ json: { venmo: "", zelle: "", cash: "", discord: "" } }),
    );
    await page.route("**/api/page-metadata", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Red Rock Canyon Hike (Week 2) | AAC</title>",
      }),
    );
    await page.route("**/api/events/42", (route) =>
      route.fulfill({ json: event }),
    );
    await page.route("**/media/fixture-photo/medium", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e6eee7"/></svg>',
      }),
    );
    await page.goto(`/events/${event.slug}/${event.id}`);
    await expect(page.locator(".event-intro h1")).toHaveText(event.name);
    await expect(page.locator(".preserve-lines")).toContainText(trailURL);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      body: document.documentElement.scrollWidth,
    }));
    expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width + 1,
    );
    await expect(page.locator(".event-schedule")).toBeVisible();
    await expect(page.locator(".event-signup-stats")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in to sign up!" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("event-long-url.png"),
      fullPage: true,
    });
  });
}
