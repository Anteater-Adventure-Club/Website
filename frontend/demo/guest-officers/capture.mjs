import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const base = process.env.DEMO_URL || "http://127.0.0.1:5180";
const output = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../design/guest-officer-access/screenshots",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 1000 },
};
const failures = [];
const manifest = {
  captured_at: new Date().toISOString(),
  viewports,
  screenshots: [],
};
try {
  const guide = await browser.newPage();
  await guide.goto(`${base}/demo`);
  const scenes = (await guide.evaluate(() => window.demoScenes)).filter(
    (s) =>
      !process.env.DEMO_SCENES ||
      process.env.DEMO_SCENES.split(",").includes(s.id),
  );
  await guide.close();
  for (const [size, viewport] of Object.entries(viewports)) {
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.url().includes("/api/") && r.status() >= 400)
          errors.push(`${r.status()} ${r.url()}`);
      });
      try {
        await page.goto(
          `${base}${scene.path}${scene.path.includes("?") ? "&" : "?"}guestDemo=${scene.role}`,
        );
        await page.locator("h1").waitFor();
        if (scene.role !== "full" && scene.role !== "expired")
          await page.getByText(/Guest access · expires/).waitFor();
        if (scene.id === "grant") {
          await page
            .getByRole("button", { name: "Grant Guest Access", exact: true })
            .click();
          await page.getByLabel("Find an existing member").fill("Alex");
          await page.getByRole("button", { name: /Alex Rivera/ }).click();
          await page.getByLabel("Check-in & Carpools", { exact: true }).check();
        }
        if (scene.id === "revoke")
          await page
            .getByRole("button", { name: "Revoke Guest Access", exact: true })
            .first()
            .click();
        if (scene.id === "renew")
          await page
            .getByRole("button", { name: "Renew Access", exact: true })
            .click();
        if (scene.id === "member-detail")
          await page
            .getByRole("button", { name: "Details", exact: true })
            .click();
        if (scene.id === "board-edit")
          await page
            .getByRole("button", { name: "Edit Profile", exact: true })
            .click();
        if (scene.id === "manage")
          await page
            .getByRole("heading", { name: "Guest officer access", exact: true })
            .scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        // Allow the already-requested panels to finish rendering; polling remains active.
        await page.waitForTimeout(400);
        const loading = await page
          .getByText("Loading…", { exact: true })
          .count();
        if (loading) errors.push("Unresolved loading state");
        if (errors.length) throw new Error(errors.join("\n"));
        await page.screenshot({
          path: resolve(output, `${scene.id}-${size}.png`),
          fullPage: ![
            "grant",
            "renew",
            "revoke",
            "member-detail",
            "board-edit",
            "manage",
          ].includes(scene.id),
          animations: "disabled",
        });
        manifest.screenshots.push(`${scene.id}-${size}.png`);
        console.log(`Captured ${scene.id} / ${size}`);
      } catch (e) {
        failures.push(`${scene.id}/${size}: ${e.message}`);
        console.error(failures.at(-1));
        await page.screenshot({
          path: resolve(output, `failure-${scene.id}-${size}.png`),
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    }
  }
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`Captured ${manifest.screenshots.length} screenshots.`);
