import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const fixture = JSON.parse(
  fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
);
const field = `/admin/events/${fixture.events.Field.slug}/${fixture.events.Field.id}`;
async function identify(context: BrowserContext, role?: string) {
  if (role)
    await context.addCookies([
      {
        name: "aac_session",
        value: fixture.cookies[role],
        domain: "localhost",
        path: "/",
      },
    ]);
}
async function settled(page: Page) {
  await page.locator("h1,h2").first().waitFor();
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).not.toContainText("A little detour");
  const size = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(size.content, JSON.stringify(size)).toBeLessThanOrEqual(
    size.viewport + 1,
  );
}
for (const view of [
  { name: "home", route: "/" },
  { name: "calendar", route: "/events" },
  { name: "board", route: "/board" },
  { name: "membership", route: "/my-aac/membership", role: "Member" },
  {
    name: "membership-signup",
    route: "/my-aac/membership",
    role: "General Rider",
  },
  { name: "profile", route: "/my-aac/profile", role: "Driver" },
  { name: "members", route: "/admin/members", role: "officer" },
  { name: "editor", route: "/admin/events/new", role: "officer" },
  { name: "check-in", route: field + "/check-in", role: "officer" },
  { name: "seating", route: field + "/seat", role: "officer" },
  { name: "close-out", route: "/admin/reimbursements", role: "officer" },
])
  test(`B01 ${view.name} fits at layout boundaries`, async ({
    page,
    context,
  }, info) => {
    await identify(context, view.role);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(view.route);
    await settled(page);
    expect(errors).toEqual([]);
    const directory = path.resolve(
      `../artifacts/boundaries/${info.project.name}`,
    );
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({
      path: `${directory}/${view.name}.png`,
      fullPage: true,
    });
  });

test("B02 orientation changes preserve unsaved form values", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "chromium-768",
    "One portrait/landscape transition is sufficient",
  );
  await identify(context, "officer");
  await page.goto("/admin/events/new");
  const name = page.getByLabel("Event name", { exact: true });
  await name.fill("Unsaved orientation acceptance event");
  await page.setViewportSize({ width: 1024, height: 768 });
  await settled(page);
  await expect(name).toHaveValue("Unsaved orientation acceptance event");
  await page.setViewportSize({ width: 390, height: 844 });
  await settled(page);
  await expect(name).toHaveValue("Unsaved orientation acceptance event");
});

test("B05 homepage photos rotate and respect reduced motion", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chromium-1025",
    "One photo-rotation check is sufficient",
  );
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let photoCount = 3;
  await page.route("**/api/home", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.polaroids = Array.from({ length: photoCount }, (_, index) => ({
      ...data.polaroids[0],
      event_id: 10000 + index,
      title: `Rotation fixture ${index}`,
    }));
    await route.fulfill({ json: data });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /^(Pause|Resume) photos$/ }),
  ).toHaveCount(0);
  const photos = page.locator(".hero-polaroids");
  await expect(photos.locator(".polaroid-title").first()).toHaveText(
    "Rotation fixture 0",
  );
  const initial = await photos.innerText();
  await page.clock.fastForward(6500);
  await expect(photos).not.toHaveText(initial);

  // A phone shows one card, so two published recaps must still cycle.
  photoCount = 2;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const visibleTitle = page.locator(
    ".hero-polaroids .polaroid:visible .polaroid-title",
  );
  await expect(visibleTitle).toHaveCount(1);
  await expect(visibleTitle).toHaveText("Rotation fixture 0");
  const firstTitle = await visibleTitle.innerText();
  await page.clock.fastForward(6500);
  await expect(visibleTitle).not.toHaveText(firstTitle);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(visibleTitle).toHaveCount(1);
  await expect(visibleTitle).toHaveText("Rotation fixture 0");
  const reducedMotionTitle = await visibleTitle.innerText();
  await page.clock.fastForward(6500);
  await expect(visibleTitle).toHaveText(reducedMotionTitle);
});

test("B03 keyboard menu dismissal and dialog focus restoration", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "chromium-1025",
    "One keyboard session is sufficient",
  );
  await identify(context, "officer");
  await page.goto("/admin/members");
  const toggle = page.getByRole("button", { name: "Open account menu" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  const trigger = page.getByRole("button", { name: "Import", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("B04 stale officer slug redirects and keeps the selected tab", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "chromium-1025",
    "One canonical route check is sufficient",
  );
  await identify(context, "officer");
  await page.goto(
    `/admin/events/old-event-title/${fixture.events.Field.id}?tab=carpools`,
  );
  await expect(page).toHaveURL(`${field}?tab=carpools`);
  await expect(
    page.getByRole("button", { name: "Carpools", exact: true }),
  ).toHaveClass("selected");
});
