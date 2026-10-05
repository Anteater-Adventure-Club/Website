import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const versions = JSON.parse(
  readFileSync(
    new URL("../../../assets/static-asset-versions.json", import.meta.url),
    "utf8",
  ),
);

test.beforeEach(({ baseURL }) => {
  if (!baseURL || new URL(baseURL).hostname !== "localhost")
    throw new Error(
      "Page-speed checks require the local production Nginx preview",
    );
});

test("initial HTML discovers the rendered hero once without waiting for home API", async ({
  page,
}, info) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/api/home", (route) => route.abort());
  const response = await page.goto("/");
  const html = await response!.text();
  expect(html).toContain('id="aac-home-data"');
  const hero = page.locator(".hero-polaroids img").first();
  await expect(hero).toBeVisible();
  await expect
    .poll(() =>
      hero.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const preload = page.locator('link[rel="preload"][as="image"]');
  expect(await preload.getAttribute("imagesrcset")).toBe(
    await hero.getAttribute("srcset"),
  );
  expect(await preload.getAttribute("imagesizes")).toBe(
    await hero.getAttribute("sizes"),
  );
  const current = new URL(
    await hero.evaluate((img: HTMLImageElement) => img.currentSrc),
  );
  expect(current.pathname).toMatch(/\/media\/[a-f0-9]{32}\/small$/);
  expect(requests.filter((path) => path === current.pathname)).toHaveLength(1);
  expect(requests).not.toContain("/api/home");
  expect(requests).not.toContain("/api/page-metadata");
  expect(requests.filter((path) => path.startsWith("/fonts/"))).toEqual(
    expect.arrayContaining([
      "/fonts/Chivo-Regular-basic.woff2",
      "/fonts/Lazydog-basic.woff2",
    ]),
  );
  expect(requests.some((path) => path.includes("-latin.woff2"))).toBe(false);
  expect(requests.some((path) => path.includes("griffith_park"))).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath("homepage.png"),
    fullPage: true,
  });
});

test("real robots, cache lifetimes, and narrow analytics policy are served by Nginx", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toBe(
    "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /my-aac/\nDisallow: /api/\n",
  );
  const path = "/images/responsive/griffith_park-320.webp";
  const version = versions[path];
  expect(
    (await request.get(`${path}?v=${version}`)).headers()["cache-control"],
  ).toBe("public, max-age=31536000, immutable");
  expect((await request.get(path)).headers()["cache-control"]).toBe(
    "public, max-age=86400",
  );
  const html = await request.get("/");
  expect(html.headers()["cache-control"]).toBe("no-cache");
  const policy = html.headers()["content-security-policy"];
  expect(policy).toContain(
    "script-src 'self' https://static.cloudflareinsights.com;",
  );
  expect(policy).toContain("connect-src 'self';");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("homepage headings form a useful outline and pass accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".card-grid .event-card").first()).toBeVisible();
  expect(await page.locator("h1").count()).toBe(1);
  expect(
    await page.locator(".hero-polaroids h2, .hero-polaroids h3").count(),
  ).toBe(0);
  expect(await page.locator(".activity-copy h3").count()).toBe(4);
  const levels = await page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) => headings.map((node) => Number(node.tagName[1])));
  for (let index = 1; index < levels.length; index++)
    expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});

test("malformed bootstrap falls back to the public API", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/home") requests++;
  });
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /(<script id="aac-home-data" type="application\/json">).*?(<\/script>)/s,
      "$1malformed$2",
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  await expect(
    page.locator(".hero-polaroids .polaroid-title").first(),
  ).toHaveText("Fixture Tide Pools");
  expect(requests).toBe(1);
});

test("bootstrapped polaroids rotate and homepage navigation remains available", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /(<script id="aac-home-data" type="application\/json">)(.*?)(<\/script>)/s,
      (_, start, json, end) => {
        const data = JSON.parse(json);
        data.polaroids.push({
          ...data.polaroids[0],
          event_id: 999999,
          title: "Second fixture photo",
        });
        return start + JSON.stringify(data).replaceAll("<", "\\u003c") + end;
      },
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  const first = page.locator(".hero-polaroids .polaroid-title").first();
  await expect(first).toHaveText("Fixture Tide Pools");
  await page.clock.fastForward(6100);
  await expect(first).toHaveText("Second fixture photo");
  await page
    .getByRole("link", { name: "Join the adventure!", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(
    page.getByRole("heading", { name: "Stay up to date!" }),
  ).toBeVisible();
  // Browser back works at phone widths where Home is inside the menu.
  await page.goBack();
  await expect(page.locator(".hero h1")).toBeVisible();
});

test("Cloudflare-origin scripts execute and can report to the same origin", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route(
    "https://static.cloudflareinsights.com/beacon.min.js",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'fetch("/cdn-cgi/rum", {method:"POST", body:"synthetic local CSP check"}).then(() => { window.analyticsPolicyPassed = true; });',
      }),
  );
  await page.route("**/cdn-cgi/rum", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "https://static.cloudflareinsights.com/beacon.min.js";
    document.head.append(script);
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).analyticsPolicyPassed))
    .toBe(true);
  expect(errors).toEqual([]);
});
