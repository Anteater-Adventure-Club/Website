import { test, expect } from "@playwright/test";
import path from "node:path";

// VisualViewport simulation exercises our layout, not Safari's native keyboard.
test("vehicle dialog follows the visible viewport and clears sticky actions", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const native = window.visualViewport!;
    let height: number | null = null;
    let offset = 0;
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => height ?? native.height },
      offsetTop: { get: () => offset },
      scale: { get: () => native.scale },
    });
    Object.defineProperty(window, "visualViewport", { value: viewport });
    (window as any).simulateKeyboard = (
      nextHeight: number | null,
      nextOffset = 0,
    ) => {
      height = nextHeight;
      offset = nextOffset;
      viewport.dispatchEvent(new Event("resize"));
    };
  });
  await page.goto("/tests/fixtures/keyboard-dialog.html");
  const dialog = page.getByRole("dialog");
  const make = dialog.getByLabel("Make", { exact: true });
  await expect(dialog).toBeVisible();
  await make.focus();
  const dimensions = page.viewportSize()!;
  const height = dimensions.height - 360;
  await page.evaluate(
    (height) => (window as any).simulateKeyboard(height, 40),
    height,
  );
  await expect(page.locator("html")).toHaveClass(/keyboard-open/);
  await expect
    .poll(async () => Math.round((await dialog.boundingBox())!.y))
    .toBe(40);
  await expect
    .poll(async () => Math.round((await dialog.boundingBox())!.height))
    .toBe(height);
  await expect
    .poll(() =>
      make.evaluate((element) => {
        const field = element.getBoundingClientRect();
        const footer = element
          .closest("dialog")!
          .querySelector(".sticky-actions")!
          .getBoundingClientRect();
        return field.top >= 52 && field.bottom <= footer.top - 8;
      }),
    )
    .toBe(true);
  await make.pressSequentially("Example");
  await expect(make).toHaveValue("Example");
  await expect(make).toBeFocused();
  expect(
    await make.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  const directory = path.resolve("../artifacts/issue-4");
  await dialog.evaluate((element, boundary) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.keyboardSimulation = "true";
    overlay.textContent = "Simulated keyboard area (not native iOS)";
    overlay.style.cssText = `position:fixed;left:0;right:0;top:${boundary}px;bottom:0;background:#c9ced3;color:#222;padding:24px;font:16px sans-serif;z-index:99;`;
    element.append(overlay);
  }, height + 40);
  await page.screenshot({
    path: `${directory}/${info.project.name}-after-focused.png`,
  });
  // Controlled old-CSS comparison at the same scroll position, not a device capture.
  const old = await page.addStyleTag({
    content:
      ":root.keyboard-open dialog {top:auto;bottom:var(--keyboard-bottom,0px);height:auto;max-height:calc(var(--visible-height,100dvh)*.9);padding-bottom:max(1.5rem,env(safe-area-inset-bottom));}",
  });
  await page.screenshot({
    path: `${directory}/${info.project.name}-before-focused.png`,
  });
  await old.evaluate((element) => element.remove());
  await page.evaluate(
    (height) => (window as any).simulateKeyboard(height, 96),
    height,
  );
  await expect
    .poll(async () => Math.round((await dialog.boundingBox())!.y))
    .toBe(96);
  await expect(make).toBeFocused();
  await dialog
    .locator("[data-keyboard-simulation]")
    .evaluate((element) => element.remove());
  await page.evaluate(() => (window as any).simulateKeyboard(null));
  await expect(page.locator("html")).not.toHaveClass(/keyboard-open/);
  await expect(make).toHaveValue("Example");
  expect((await dialog.boundingBox())!.height).toBeLessThan(dimensions.height);
});

test("desktop dialog retains ordinary size and focus behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tests/fixtures/keyboard-dialog.html");
  const dialog = page.getByRole("dialog");
  const make = dialog.getByLabel("Make", { exact: true });
  await make.focus();
  await make.fill("Desktop");
  await expect(make).toBeFocused();
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBe(600);
  expect(box.y).toBeGreaterThan(0);
  expect(box.height).toBeLessThan(900);
  await expect(page.locator("html")).not.toHaveClass(/keyboard-open/);
});
