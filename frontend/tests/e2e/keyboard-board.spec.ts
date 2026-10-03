import { expect, test, type Locator, type Page } from "@playwright/test";

const term = {
  id: 1,
  label: "2026–2027",
  start_year: 2026,
  current: true,
  revision: 1,
};
const person = {
  id: 1,
  name: "Board Member",
  email: "board@uci.edu",
  phone: "",
  pronouns: "",
  discord: "",
  student: true,
  can_drive: null,
  driving_preferences: "",
  payout_method: "",
  payout_destination: "",
  payout_phone_suffix: "",
};

// Exercise the actual officer UI with isolated API responses, without touching
// a database or requiring an authenticated session on a deployed site.
test.beforeEach(async ({ page, baseURL }) => {
  if (
    !baseURL ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
  )
    throw new Error(
      "Board keyboard checks require the isolated local application",
    );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/page-metadata") {
      await route.fulfill({
        contentType: "text/html",
        body: "<title>Officers & Board</title>",
      });
      return;
    }
    const responses: Record<string, unknown> = {
      "/api/session": {
        member: person,
        officer: true,
        oauth_available: false,
        profile_complete: true,
      },
      "/api/quarters": { items: [] },
      "/api/site-settings": { discord: "" },
      "/api/admin/officers": { items: [] },
      "/api/admin/board/terms": { items: [term] },
      "/api/admin/board/terms/1": { term, entries: [] },
      "/api/admin/members": { items: [{ member: person }], total: 1 },
    };
    if (
      path === "/api/admin/board/terms/1/entries" &&
      route.request().method() === "POST"
    ) {
      await route.fulfill({
        json: {
          ...route.request().postDataJSON(),
          id: 1,
          term_id: 1,
          revision: 1,
        },
      });
    } else if (path in responses) {
      await route.fulfill({ json: responses[path] });
    } else {
      throw new Error(
        `Unexpected API request: ${route.request().method()} ${path}`,
      );
    }
  });
  await page.addInitScript(() => {
    const native = window.visualViewport!;
    const state = { height: null as number | null, offset: 0 };
    const simulated = new EventTarget();
    for (const key of [
      "width",
      "scale",
      "offsetLeft",
      "pageLeft",
      "pageTop",
    ] as const)
      Object.defineProperty(simulated, key, { get: () => native[key] });
    Object.defineProperties(simulated, {
      height: { get: () => state.height ?? native.height },
      offsetTop: {
        get: () => (state.height === null ? native.offsetTop : state.offset),
      },
    });
    Object.defineProperty(window, "visualViewport", { value: simulated });
    (window as any).boardKeyboard = (height: number | null, offset = 0) => {
      state.height = height;
      state.offset = offset;
      simulated.dispatchEvent(new Event("resize"));
      simulated.dispatchEvent(new Event("scroll"));
    };
    native.addEventListener("resize", () =>
      simulated.dispatchEvent(new Event("resize")),
    );
    native.addEventListener("scroll", () =>
      simulated.dispatchEvent(new Event("scroll")),
    );
  });
  await page.goto("/admin/officers");
  await page
    .getByRole("button", { name: "Add Board Profile", exact: true })
    .first()
    .click();
});

const sheet = (page: Page) => page.getByRole("dialog").last();
const settle = (page: Page) => page.waitForTimeout(180);

async function typeWithoutJumping(field: Locator, value: string) {
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  await settle(field.page());
  const before = await field.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    pageY: window.scrollY,
  }));
  let typed = "";
  for (const character of value) {
    await field.pressSequentially(character);
    typed += character;
    await expect(field).toHaveValue(typed);
    await expect(field).toBeFocused();
  }
  await settle(field.page());
  const after = await field.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    pageY: window.scrollY,
  }));
  expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
  expect(after.pageY).toBe(before.pageY);
}

for (const mode of ["visual", "content"] as const) {
  test(`board ${mode} keyboard preserves typed profile and submitted values`, async ({
    page,
  }) => {
    const viewport = page.viewportSize()!;
    const name = sheet(page).getByLabel("Name", { exact: true });
    await name.focus();
    if (mode === "visual")
      await page.evaluate(() => (window as any).boardKeyboard(480));
    else await page.setViewportSize({ width: viewport.width, height: 480 });
    await typeWithoutJumping(name, "Gabe Dodge");
    await typeWithoutJumping(
      sheet(page).getByLabel("Officer role", { exact: true }),
      "President",
    );
    await typeWithoutJumping(
      sheet(page).getByLabel("Major / year", { exact: true }),
      "Computer Science",
    );
    const bio = sheet(page).getByLabel("About them", { exact: true });
    await typeWithoutJumping(bio, "I love hiking.");
    await bio.press("Enter");
    await bio.pressSequentially("And camping.");
    await expect(bio).toHaveValue("I love hiking.\nAnd camping.");
    await typeWithoutJumping(
      sheet(page).getByLabel("Favorite AAC memory", { exact: true }),
      "Our first trip",
    );
    await name.focus();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      (window as any).boardKeyboard(null);
    });
    await page.setViewportSize(viewport);
    await expect(name).toHaveValue("Gabe Dodge");
    const saved = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/admin/board/terms/1/entries") &&
        request.method() === "POST",
    );
    await sheet(page)
      .getByRole("button", { name: "Save Profile", exact: true })
      .click();
    expect((await saved).postDataJSON()).toMatchObject({
      name: "Gabe Dodge",
      role: "President",
      major: "Computer Science",
      bio: "I love hiking.\nAnd camping.",
      memory: "Our first trip",
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("board viewport panning and nested member search preserve the draft", async ({
  page,
}) => {
  const name = sheet(page).getByLabel("Name", { exact: true });
  await name.fill("Unsaved Board Profile");
  await sheet(page)
    .getByRole("button", { name: "Choose Member", exact: true })
    .click();
  const search = sheet(page).getByLabel("Find an existing member", {
    exact: true,
  });
  await search.focus();
  await page.evaluate(() => (window as any).boardKeyboard(480, 80));
  await settle(page);
  for (const [index, character] of Array.from("Board").entries()) {
    await search.pressSequentially(character);
    await page.evaluate(
      (offset) => (window as any).boardKeyboard(480, offset),
      80 + index * 8,
    );
    await settle(page);
    await expect(search).toHaveValue("Board".slice(0, index + 1));
    await expect(search).toBeFocused();
  }
  await sheet(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue(
    "Unsaved Board Profile",
  );
});

test("keyboard movement during a touch inside the sheet does not dismiss the draft", async ({
  page,
}) => {
  await sheet(page).getByLabel("Name", { exact: true }).fill("Keep my draft");
  const box = (await sheet(page).boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height - 2);
  await page.mouse.down();
  await page.evaluate(() => (window as any).boardKeyboard(480));
  await settle(page);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(sheet(page).getByLabel("Name", { exact: true })).toHaveValue(
    "Keep my draft",
  );
});
