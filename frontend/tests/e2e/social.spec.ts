import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixtures = JSON.parse(
  fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
);

test("AAC logo and public page metadata follow navigation", async ({
  page,
}) => {
  await page.goto("/");
  const brand = page.getByRole("link", { name: "AAC Home" });
  await expect(brand).toBeVisible();
  await expect
    .poll(() =>
      brand
        .locator("img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/api\/share-images\/pages\/home\.jpg\?v=[a-f0-9]+$/,
  );
  await expect(
    page.locator('link[rel="icon"][type="image/svg+xml"]'),
  ).toHaveAttribute("href", "/logos/aac.svg?v=transparent");
  const mobile = await page
    .getByRole("button", { name: "Open navigation" })
    .isVisible();
  if (mobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", {
    name: mobile ? "Mobile navigation" : "Main navigation",
  });
  await nav.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page).toHaveTitle("Meet the Board | Anteater Adventure Club");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    /\/board$/,
  );
  await brand.click();
  await expect(page).toHaveTitle("Anteater Adventure Club");
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Event sharing uses a designed card with its name and date", async ({
  page,
}) => {
  const event = fixtures.events.Adventure;
  await page.goto(`/events/${event.slug}/${event.id}`);
  await expect(page).toHaveTitle(`${event.name} | AAC`);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /\d{4}/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    event.name,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`/api/share-images/events/${event.id}\\.jpg\\?v=[a-f0-9]+$`),
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(
    page.getByRole("heading", { name: event.name, exact: true }),
  ).toBeVisible();
});

test("Private links share generic text", async ({ page }) => {
  await page.goto("/sign-in?return_to=/my-aac/profile&secret=do-not-share");
  await expect(page).toHaveTitle("Sign In | Anteater Adventure Club");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    /\/sign-in$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});

test("A crawler receives event metadata in the initial HTML", async ({
  request,
}) => {
  test.skip(
    !process.env.E2E_SERVES_METADATA,
    "Requires the production Nginx server",
  );
  const event = fixtures.events.Adventure;
  const response = await request.get(`/events/${event.slug}/${event.id}`, {
    headers: { "User-Agent": "Discordbot/2.0", "X-AAC-Page-URI": "/board" },
  });
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain(
    `<meta property="og:title" content="${event.name}" />`,
  );
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain(`api/share-images/events/${event.id}.jpg?v=`);
  expect(html).not.toContain("<!--#");
  expect(html.match(/<title>/g)).toHaveLength(1);
  const browserResponse = await request.get(
    `/events/${event.slug}/${event.id}`,
  );
  expect(await browserResponse.text()).toBe(html);
  const imageResponse = await request.get(
    `/api/share-images/events/${event.id}.jpg`,
  );
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()["content-type"]).toBe("image/jpeg");
  expect((await request.get("/_page-metadata")).status()).toBe(404);
});
