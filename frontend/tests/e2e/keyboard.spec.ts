import { test, expect, type Page, type Locator } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type KeyboardMode = "visual" | "content";
let fixture: any;
const testURL = process.env.E2E_BASE_URL || "http://localhost:5173";

test.beforeEach(async ({ page, context, baseURL }) => {
  if (baseURL !== testURL || new URL(testURL).hostname !== "localhost")
    throw new Error(
      "Keyboard mutations require the isolated local application",
    );
  execFileSync(process.env.E2E_PYTHON || "../.venv/bin/python", [
    "../scripts/seed-browser-fixtures.py",
  ]);
  fixture = JSON.parse(
    fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
  );
  await context.addCookies([
    {
      name: "aac_session",
      value: fixture.cookies.officer,
      domain: "localhost",
      path: "/",
    },
  ]);
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
    Object.defineProperty(simulated, "height", {
      get: () => state.height ?? native.height,
    });
    Object.defineProperty(simulated, "offsetTop", {
      get: () => (state.height === null ? native.offsetTop : state.offset),
    });
    Object.defineProperty(window, "visualViewport", { value: simulated });
    (window as any).keyboardTest = (height: number | null, offset = 0) => {
      state.height = height;
      state.offset = offset;
      document.querySelector("[data-keyboard-simulation]")?.remove();
      if (height !== null) {
        const overlay = document.createElement("div");
        overlay.dataset.keyboardSimulation = "true";
        overlay.setAttribute("aria-hidden", "true");
        overlay.textContent = "Simulated on-screen keyboard";
        overlay.style.cssText = `position:fixed;left:0;right:0;top:${height + offset}px;bottom:0;z-index:1000000;background:#c9ced3;color:#222;padding:24px;font:16px sans-serif;`;
        (document.activeElement?.closest("dialog") || document.body).append(
          overlay,
        );
      }
      simulated.dispatchEvent(new Event("resize"));
    };
    native.addEventListener("resize", () =>
      simulated.dispatchEvent(new Event("resize")),
    );
    native.addEventListener("scroll", () =>
      simulated.dispatchEvent(new Event("scroll")),
    );
  });
});

test.afterEach(async ({ page }, info) => {
  const directory = path.resolve(`../artifacts/keyboard/${info.project.name}`);
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/${info.title.replace(/[^a-z0-9-]/gi, "-")}.png`,
  });
});

async function keyboard(page: Page, mode: KeyboardMode, field: Locator) {
  const viewport = page.viewportSize()!;
  await field.scrollIntoViewIfNeeded();
  await field.focus();
  const height = Math.max(300, viewport.height - 360);
  if (mode === "visual")
    await page.evaluate(
      (height) => (window as any).keyboardTest(height),
      height,
    );
  else await page.setViewportSize({ width: viewport.width, height });
  return async () => {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      (window as any).keyboardTest(null);
    });
    await page.setViewportSize(viewport);
  };
}

async function reachable(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const viewport = window.visualViewport!;
        return (
          box.top >= viewport.offsetTop - 1 &&
          box.bottom <= viewport.offsetTop + viewport.height + 1
        );
      }),
    )
    .toBe(true);
}

async function inputReadable(field: Locator) {
  await expect(field).toBeFocused();
  await reachable(field);
  expect(
    await field.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
}

async function submit(page: Page, button: Locator) {
  await button.scrollIntoViewIfNeeded();
  await reachable(button);
  await button.click();
}

const modal = (page: Page) => page.getByRole("dialog").last();
const eventPath = (name: string) =>
  `/admin/events/${fixture.events[name].slug}/${fixture.events[name].id}`;

for (const mode of ["visual", "content"] as const) {
  test(`K01 ${mode} profile typing, multiline Enter, submit and repeated dismissal`, async ({
    page,
  }) => {
    await page.goto("/my-aac/profile");
    const preferences = page.getByLabel("Driving preferences", { exact: true });
    const dismiss = await keyboard(page, mode, preferences);
    await preferences.fill("Keyboard acceptance line one");
    await preferences.press("End");
    await preferences.press("Enter");
    await preferences.pressSequentially("Line two remains editable");
    await inputReadable(preferences);
    await expect(preferences).toHaveValue(
      "Keyboard acceptance line one\nLine two remains editable",
    );
    await expect(page.getByText("Profile saved.", { exact: true })).toHaveCount(
      0,
    );
    await submit(
      page,
      page.getByRole("button", { name: "Save Profile", exact: true }),
    );
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();
    await dismiss();
    await expect(preferences).toHaveValue(
      "Keyboard acceptance line one\nLine two remains editable",
    );
    const closeAgain = await keyboard(page, mode, preferences);
    await inputReadable(preferences);
    await closeAgain();
    await expect(page.locator("[data-keyboard-simulation]")).toHaveCount(0);
  });

  test(`K02 ${mode} car bottom sheet keeps text, numeric input and save above keyboard`, async ({
    page,
  }) => {
    await page.goto("/my-aac/profile");
    await page
      .getByRole("button", { name: /Add.*car/i })
      .first()
      .click();
    await modal(page).getByLabel("Year", { exact: true }).fill("2024");
    await modal(page).getByLabel("Make", { exact: true }).fill("Toyota");
    await modal(page).getByLabel("Model", { exact: true }).fill("Corolla");
    const seats = modal(page).getByLabel("Passenger seats", { exact: true });
    const dismiss = await keyboard(page, mode, seats);
    await seats.fill("4");
    await inputReadable(seats);
    await reachable(modal(page));
    await submit(
      page,
      modal(page).getByRole("button", { name: "Save Car", exact: true }),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await dismiss();
    await expect(page.getByText(/2024 Toyota Corolla/).first()).toBeVisible();
  });

  test(`K03 ${mode} event multiline description, draft save and values survive keyboard`, async ({
    page,
  }) => {
    await page.goto("/admin/events/new");
    await page
      .getByLabel("Event name", { exact: true })
      .fill("Keyboard acceptance draft");
    const description = page.getByLabel("Description", { exact: true });
    const dismiss = await keyboard(page, mode, description);
    await description.fill("Bring water\nMeet at the trailhead");
    await inputReadable(description);
    await submit(
      page,
      page.getByRole("button", { name: "Save Draft", exact: true }),
    );
    await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/\d+/);
    await dismiss();
    await expect(
      page.getByRole("heading", {
        name: "Keyboard acceptance draft",
        exact: true,
      }),
    ).toBeVisible();
  });

  test(`K04 ${mode} field roster search and walk-in sheet remain usable`, async ({
    page,
  }) => {
    await page.goto(eventPath("Field") + "/check-in");
    const search = page.getByRole("textbox", {
      name: "Search check-in roster",
    });
    const dismissSearch = await keyboard(page, mode, search);
    await search.fill("Fixture Member");
    await inputReadable(search);
    await expect(
      page.getByRole("button", { name: /Fixture Member Paid Member/ }),
    ).toBeVisible();
    await dismissSearch();
    await page.getByRole("button", { name: "Walk-in", exact: true }).click();
    const member = modal(page).getByLabel("Find a member", { exact: true });
    const dismissMember = await keyboard(page, mode, member);
    await member.fill("Fixture General Rider");
    await inputReadable(member);
    await reachable(modal(page));
    await modal(page)
      .getByRole("button", { name: /Fixture General Rider/ })
      .click();
    await dismissMember();
    await modal(page).getByRole("button", { name: "Close dialog" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(search).toHaveValue("Fixture Member");
  });

  test(`K05 ${mode} dues payment reference and confirmation stay reachable`, async ({
    page,
  }) => {
    await page.goto("/admin/members");
    await page.getByLabel("Search members").fill("Fixture Pending");
    await page
      .getByRole("button", { name: "Confirm Dues", exact: true })
      .click();
    const reference = modal(page).getByLabel("Reference", { exact: true });
    const dismiss = await keyboard(page, mode, reference);
    await reference.fill("Keyboard acceptance external cash");
    await inputReadable(reference);
    await reachable(modal(page));
    await submit(
      page,
      modal(page).getByRole("button", { name: "Confirm Payment", exact: true }),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await dismiss();
  });

  test(`K06 ${mode} reimbursement contact input and save survive keyboard dismissal`, async ({
    page,
  }) => {
    await page.goto("/my-aac/profile");
    await page
      .getByLabel("Where should we send your reimbursement?")
      .selectOption("venmo");
    const contact = page.getByLabel("Username, email or phone", {
      exact: true,
    });
    const dismiss = await keyboard(page, mode, contact);
    await contact.fill("@keyboard-fixture");
    await inputReadable(contact);
    await submit(
      page,
      page.getByRole("button", {
        name: "Save Reimbursement Details",
        exact: true,
      }),
    );
    await expect(
      page.getByText("Reimbursement details saved.", { exact: true }),
    ).toBeVisible();
    await dismiss();
    await expect(contact).toHaveValue("@keyboard-fixture");
  });
}
