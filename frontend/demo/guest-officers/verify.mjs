import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.DEMO_URL || "http://127.0.0.1:5180";
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const guide = await context.newPage();
  for (const [size, width, height] of [
    ["mobile", 390, 844],
    ["tablet", 834, 1112],
    ["desktop", 1440, 1000],
  ]) {
    await guide.setViewportSize({ width, height });
    await guide.goto(`${base}/demo`);
    await guide.locator(`[data-size="${size}"]`).click();
    const sources = await guide
      .locator(".screen img")
      .evaluateAll((imgs) => imgs.map((i) => i.src));
    expect(sources).toHaveLength(15);
    for (const source of sources)
      expect((await context.request.get(source)).status()).toBe(200);
    expect(
      await guide.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page: guide })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      audit.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`,
      ),
    ).toEqual([]);
    console.log(`Gallery, image links, overflow and accessibility: ${size}`);
  }
  const member = await context.newPage();
  await member.goto(`${base}/admin/members?guestDemo=members`);
  await member.getByRole("button", { name: "Details", exact: true }).click();
  await expect(member.getByRole("dialog")).toBeVisible();
  await expect(member.getByRole("button", { name: "Ban Member" })).toHaveCount(
    0,
  );
  const other = await context.newPage();
  await other.goto(`${base}/admin/officers?guestDemo=board`);
  await expect(
    other.getByRole("button", { name: "Edit Profile", exact: true }),
  ).toBeVisible();
  await member.evaluate(async () => {
    await fetch("/demo/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "expire" }),
    });
    window.dispatchEvent(new Event("focus"));
  });
  await expect(member).toHaveURL(/\/my-aac$/);
  await expect(member.getByRole("dialog")).toHaveCount(0);
  await other.reload();
  await expect(other.getByText(/Guest access · expires/)).toBeVisible();
  await other.goto(`${base}/admin/settings`);
  await expect(other).toHaveURL(/\/admin\/officers$/);
  console.log(
    "Expiry clears privileged dialogs; tabs stay isolated; forbidden routes redirect.",
  );
  const full = await context.newPage();
  await full.goto(`${base}/admin/officers?guestDemo=full`);
  await full
    .getByRole("button", { name: "Grant Guest Access", exact: true })
    .click();
  await full.getByLabel("Find an existing member").fill("Alex");
  await full.getByRole("button", { name: /Alex Rivera/ }).click();
  await full.getByLabel("Members & Dues", { exact: true }).check();
  await full
    .getByRole("button", { name: "Save Guest Access", exact: true })
    .click();
  const alex = full
    .locator(".record-card")
    .filter({ has: full.getByRole("heading", { name: /Alex Rivera/ }) });
  await expect(alex.getByText("Members & Dues", { exact: true })).toBeVisible();
  await alex.getByRole("button", { name: "Edit Access", exact: true }).click();
  await full.getByLabel("Board Profiles", { exact: true }).check();
  await full
    .getByRole("button", { name: "Save Guest Access", exact: true })
    .click();
  await expect(
    alex.getByText("Members & Dues · Board Profiles", { exact: true }),
  ).toBeVisible();
  await full.getByRole("button", { name: "Renew Access", exact: true }).click();
  await full
    .getByRole("button", { name: "Save Guest Access", exact: true })
    .click();
  await expect(
    full.getByRole("button", { name: "Renew Access", exact: true }),
  ).toHaveCount(0);
  await alex
    .getByRole("button", { name: "Revoke Guest Access", exact: true })
    .click();
  await full
    .getByRole("dialog")
    .getByRole("button", { name: "Revoke Access", exact: true })
    .click();
  await expect(alex).toHaveCount(0);
  console.log("Grant, edit, renew and revoke persist in the local demo.");
  await context.close();
} finally {
  await browser.close();
}
