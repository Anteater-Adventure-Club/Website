import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let fixture: any;
const origin = "http://localhost:5173";
async function identity(context: BrowserContext, role: string) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: "aac_session",
      value: fixture.cookies[role],
      domain: "localhost",
      path: "/",
    },
  ]);
}
async function capture(page: Page, project: string, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  const directory = path.resolve(
    `../artifacts/external-member-approval/screens/${project}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  const dialog = page.getByRole("dialog").last();
  const modal = (await dialog.count()) > 0;
  if (modal)
    await dialog.evaluate((el) => {
      el.scrollTop = 0;
    });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: !modal,
    animations: "disabled",
    scale: "css",
  });
  if (modal) {
    await dialog.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.screenshot({
      path: path.join(directory, `${name}-bottom.png`),
      animations: "disabled",
      scale: "css",
    });
  }
}

test.beforeEach(() => {
  execFileSync(
    process.env.E2E_PYTHON || "../.venv/bin/python",
    ["../scripts/seed-approval-review.py"],
    {
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql+psycopg://aac:aac@127.0.0.1:55432/aac_browser",
      },
      timeout: 60000,
      stdio: "pipe",
    },
  );
  fixture = JSON.parse(
    fs.readFileSync("../artifacts/browser-fixtures.json", "utf8"),
  );
});

test("application, officer review, final denial, and configurable questions", async ({
  page,
  context,
}, info) => {
  await identity(context, "Applicant");
  await page.goto("/my-aac/profile");
  await expect(page).toHaveURL(/\/my-aac\/application$/);
  const student = page.getByLabel("Are you currently a college student?");
  await student.selectOption("yes");
  await page
    .getByLabel("College email", { exact: true })
    .fill("jordan@sample-college.edu");
  await page.getByLabel("School", { exact: true }).fill("Orange Coast College");
  await page.getByLabel("Grade", { exact: true }).selectOption("2nd year");
  await student.selectOption("no");
  await expect(page.getByLabel("College email", { exact: true })).toHaveCount(
    0,
  );
  await student.selectOption("yes");
  await expect(page.getByLabel("College email", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByLabel("College email", { exact: true })
    .fill("jordan@sample-college.edu");
  await page.getByLabel("School", { exact: true }).fill("Orange Coast College");
  await page.getByLabel("Grade", { exact: true }).selectOption("2nd year");
  const about = page.getByLabel("Tell us a little bit about yourself.", {
    exact: true,
  });
  await about.fill("word ".repeat(251));
  await expect(about).toHaveAttribute("aria-invalid", "true");
  await about.fill(
    "I’m a second-year student who loves hiking, photography, and finding new places around Orange County. I’d love to meet other people who enjoy spending time outdoors.",
  );
  await page
    .getByLabel("Why do you want to join Adventure Club?", { exact: true })
    .fill(
      "I’m looking for a welcoming group to explore new trails with, make friends, and try camping. I’d also be happy to help with planning and cleanup at events.",
    );
  await capture(page, info.project.name, "application-student");
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanks for introducing yourself!" }),
  ).toBeVisible();
  await capture(page, info.project.name, "application-pending");
  for (const tab of [
    "",
    "/profile",
    "/signups",
    "/membership",
    "/reimbursements",
  ]) {
    await page.goto(`/my-aac${tab}`);
    await expect(page).toHaveURL(/\/my-aac\/application$/);
    await expect(
      page.getByRole("heading", { name: "Thanks for introducing yourself!" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(
    page.getByRole("link", { name: "Your application", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /^(Overview|My Signups|Profile & Cars|Reimbursements)$/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Open account menu" }).click();
  const event = Object.values(fixture.events).find(
    (e: any) => e.state === "published" && e.signups_enabled,
  ) as any;
  await page.goto(`/events/${event.slug}/${event.id}`);
  await expect(
    page.getByRole("link", { name: "View application", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save Signup", exact: true }),
  ).toHaveCount(0);
  const signup = await page.request.put(`/api/events/${event.id}/signup`, {
    headers: { Origin: origin },
    data: { role: "own" },
  });
  expect(signup.status()).toBe(403);
  expect((await signup.json()).detail.code).toBe("approval_required");

  await identity(context, "officer");
  await page.goto("/admin/overview");
  await expect(
    page.getByRole("link", { name: /New members waiting for approval/ }),
  ).toBeVisible();
  await capture(page, info.project.name, "officer-dashboard");
  await page
    .getByRole("link", { name: /New members waiting for approval/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Pending", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("Pending (Membership)", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Pending (Approval)", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^All pending$|^Pending \(/ }),
  ).toHaveCount(0);
  await capture(page, info.project.name, "members-pending");
  const alex = page.getByRole("row").filter({ hasText: "Alex Morgan" });
  await alex.getByRole("button", { name: "Review application" }).click();
  await expect(
    page.getByText("Orange Coast College", { exact: true }),
  ).toBeVisible();
  await capture(page, info.project.name, "application-review");
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Approve application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Approve application", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .last()
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: "Jordan Rivera" })
    .getByRole("button", { name: "Review application" })
    .click();
  await page
    .getByRole("button", { name: "Deny application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deny this application?" }),
  ).toBeVisible();
  const reason =
    "We cannot approve this application because it does not meet our membership criteria.";
  await page.getByLabel("Reason for denial", { exact: false }).fill(reason);
  await capture(page, info.project.name, "application-denial-review");
  await page
    .getByRole("button", { name: "Confirm denial", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deny this application?" }),
  ).toHaveCount(0);

  await identity(context, "Applicant");
  await page.goto("/my-aac/application");
  await expect(
    page.getByRole("heading", { name: "Your application was not approved" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit application", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await capture(page, info.project.name, "application-denied");
  const denied = await page.request.post("/api/me/application", {
    headers: { Origin: origin },
    data: { form_revision: 1, answers: {} },
  });
  expect(denied.status()).toBe(409);

  await identity(context, "Approval pending");
  await page.goto("/my-aac/application");
  await expect(page).toHaveURL(/\/my-aac$/);
  await expect(
    page.getByRole("heading", { name: "Hi, Alex!", exact: true }),
  ).toBeVisible();
  await capture(page, info.project.name, "application-approved");

  await identity(context, "officer");
  await page.goto("/admin/settings");
  await page
    .getByRole("button", { name: "Edit application questions" })
    .click();
  await expect(
    page.getByRole("button", { name: "Save questions" }),
  ).toBeVisible();
  await capture(page, info.project.name, "question-editor");
  const parentType = page
    .getByRole("combobox", { name: "Answer type", exact: true })
    .first();
  await expect(parentType).toBeDisabled();
  for (const condition of await page
    .getByRole("combobox", { name: "Show this question", exact: true })
    .all()) {
    await condition.selectOption("");
  }
  await expect(parentType).toBeEnabled();
  await parentType.selectOption("text");
  await page
    .getByRole("textbox", { name: "Question", exact: true })
    .nth(4)
    .fill("Tell us about your adventures.");
  await page.getByRole("button", { name: "Save questions" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await identity(context, "Applicant");
  await page.goto("/my-aac/application");
  await page.getByText("Your submitted answers", { exact: true }).click();
  await expect(
    page.getByText("Tell us a little bit about yourself.", { exact: true }),
  ).toBeVisible();
});

test("an approval arriving while the applicant waits redirects to My AAC", async ({
  page,
  context,
}) => {
  await identity(context, "Approval pending");
  await page.goto("/my-aac/application");
  await expect(
    page.getByRole("heading", { name: "Thanks for introducing yourself!" }),
  ).toBeVisible();
  const mid = fixture.people["Approval pending"].id;
  // A separate HTTP client models the officer without changing the applicant's cookie jar.
  const response = await fetch(
    `${origin}/api/admin/members/${mid}/application/decision`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: `aac_session=${fixture.cookies.officer}`,
      },
      body: JSON.stringify({ decision: "approved" }),
    },
  );
  expect(response.status).toBe(200);
  await expect(page).toHaveURL(/\/my-aac$/);
  await expect(
    page.getByRole("heading", { name: "Hi, Alex!", exact: true }),
  ).toBeVisible();
});
