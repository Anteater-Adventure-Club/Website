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
      document.getAnimations().map((a) => a.finished.catch(() => {})),
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
  const dir = path.resolve(`../artifacts/event-forms/screens/${project}`);
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  const dialog = page.getByRole("dialog").last();
  const modal = (await dialog.count()) > 0;
  if (modal)
    await dialog.evaluate((el) => {
      el.scrollTop = 0;
    });
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: !modal,
    animations: "disabled",
    scale: "css",
  });
  if (modal) {
    await dialog.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.screenshot({
      path: path.join(dir, `${name}-bottom.png`),
      animations: "disabled",
      scale: "css",
    });
  }
}

test.beforeEach(() => {
  execFileSync(
    process.env.E2E_PYTHON || "../.venv/bin/python",
    ["../scripts/seed-event-forms-review.py"],
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

test("member reminders, conditional response, edits, late submission and access", async ({
  page,
  context,
}, info) => {
  await identity(context, "Form member");
  const base = fixture.event_forms.url;
  await page.goto("/membership");
  await expect(
    page.getByRole("complementary", { name: "Forms needing your attention" }),
  ).toContainText("Yosemite gear check");
  await capture(page, info.project.name, "banner");
  await page.goto("/my-aac/profile");
  await expect(
    page.getByRole("complementary", { name: "Forms needing your attention" }),
  ).toBeVisible();
  await page.goto(base + "/form/1");
  await expect(
    page.getByRole("heading", { name: "Yosemite gear check", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Are you still joining us for Yosemite?")
    .selectOption("yes");
  await page.getByLabel("Sleeping bag", { exact: true }).check();
  await page
    .getByLabel("Anything else we should know?")
    .fill("I can help set up camp.");
  await capture(page, info.project.name, "member-form");
  await page
    .getByRole("button", { name: "Submit response", exact: true })
    .click();
  await expect(page.getByText("Your response is saved.")).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Forms needing your attention" }),
  ).toHaveCount(0);
  await capture(page, info.project.name, "saved-response");
  await page
    .getByRole("button", { name: "Edit response", exact: true })
    .click();
  await page
    .getByLabel("Anything else we should know?")
    .fill("I can help set up camp and cook dinner.");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("I can help set up camp and cook dinner."),
  ).toBeVisible();
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Event forms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Pending forms" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(
    page.locator(".member-event-forms-responded > summary"),
  ).toHaveText("Responded (3)");
  await expect(
    page.getByRole("link", {
      name: "Edit response for Yosemite gear check",
      exact: true,
    }),
  ).toBeHidden();
  await capture(page, info.project.name, "event-page");
  await identity(context, "Form missing");
  await page.goto(base + "/form/2");
  await expect(
    page.getByText(
      "The deadline has passed. You can still submit a late response.",
    ),
  ).toBeVisible();
  await capture(page, info.project.name, "late-form");
  await page
    .getByLabel("Are you still joining us for Yosemite?")
    .selectOption("no");
  await page
    .getByRole("button", { name: "Submit response", exact: true })
    .click();
  await expect(
    page.locator("main").getByText("Responded late", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit response" })).toHaveCount(
    0,
  );
  await identity(context, "Form new");
  await page.goto(base + "/form/4");
  await expect(
    page.getByText(
      "You signed up after this form closed, so a response is not required.",
    ),
  ).toBeVisible();
  await identity(context, "Member");
  await page.goto(base + "/form/1");
  await expect(
    page.getByText("Sign up for this event to access its forms."),
  ).toBeVisible();
});

test("officer hub, templates, publication, and signup defaults", async ({
  page,
  context,
}, info) => {
  await identity(context, "officer");
  await page.goto("/admin/forms");
  await expect(
    page.getByRole("heading", { name: "Forms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Yosemite gear check", exact: true }),
  ).toBeVisible();
  await capture(page, info.project.name, "forms-hub");
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Retreat signup questions" }),
  ).toBeVisible();
  await capture(page, info.project.name, "templates");
  await page.getByRole("button", { name: "Edit template" }).last().click();
  await capture(page, info.project.name, "template-editor");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "External application", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit application questions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Event forms", exact: true }).click();
  await page
    .getByRole("button", { name: "New event form", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Event", exact: true })
    .selectOption(String(fixture.event_forms.event_id));
  await page
    .getByRole("combobox", { name: "Use a template" })
    .selectOption("template-gear");
  await page
    .getByLabel("Form title", { exact: true })
    .fill("Weekend equipment check");
  await page
    .getByRole("combobox", { name: "Allow Late Submissions?", exact: true })
    .selectOption("yes");
  await capture(page, info.project.name, "form-editor");
  await page.getByRole("button", { name: "Publish form", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Weekend equipment check", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page
    .getByLabel("Are you still joining us for Yosemite?")
    .selectOption("yes");
  await expect(page.getByLabel("Sleeping bag", { exact: true })).toBeVisible();
  await page.goto("/admin/events/new");
  await page
    .getByRole("combobox", { name: "Event type" })
    .selectOption("retreat");
  await page.getByRole("tab", { name: "Signups & Carpools" }).click();
  await expect(
    page.locator('input[value="Tell us about your camping experience."]'),
  ).toBeVisible();
});

test("officer roster, responses, cancellation, and form spreadsheet controls", async ({
  page,
  context,
}, info) => {
  await identity(context, "officer");
  const base = "/admin" + fixture.event_forms.url;
  await page.goto(base);
  await expect(
    page.getByText("No Response", { exact: true }).first(),
  ).toBeVisible();
  await capture(page, info.project.name, "roster");
  await page.getByLabel("No Response to required forms").check();
  await expect(page.getByText("Sam Taylor", { exact: true })).toBeVisible();
  await expect(page.getByText("Alex Morgan", { exact: true })).toHaveCount(0);
  await page.goto(base + "/form/1");
  await capture(page, info.project.name, "responses");
  if (info.project.name === "phone") {
    await expect(page.getByText("Swipe or drag across answers")).toBeHidden();
    await expect(
      page.getByRole("columnheader", {
        name: "What gear do you need to borrow?",
      }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "View answers" }).first().click();
    await expect(page.getByRole("dialog")).toContainText("Sleeping bag");
    await capture(page, info.project.name, "response-answers");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
  } else {
    const grid = page.getByRole("region", {
      name: "Form responses",
      exact: true,
    });
    const alex = grid.getByRole("row").filter({ hasText: "Alex Morgan" });
    const casey = grid.getByRole("row").filter({ hasText: "Casey Chen" });
    await expect(
      page.getByRole("button", { name: "View answers" }),
    ).toHaveCount(0);
    await expect(
      grid.getByRole("columnheader", {
        name: "What gear do you need to borrow?",
      }),
    ).toBeVisible();
    await expect(
      alex.getByRole("cell", {
        name: "Sleeping bag Sleeping pad",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      casey.getByRole("cell", { name: "No", exact: true }),
    ).toBeVisible();
    await expect(
      casey.getByRole("cell", { name: "Not applicable", exact: true }),
    ).toBeVisible();
    const memberBefore = await alex
      .locator(".response-member-cell")
      .boundingBox();
    const left = page.getByRole("button", { name: "Scroll responses left" });
    const right = page.getByRole("button", { name: "Scroll responses right" });
    await expect(left).toBeDisabled();
    await expect(right).toBeEnabled();
    await expect(page.getByText("Swipe or drag across answers")).toBeVisible();
    await right.click();
    await expect
      .poll(() => grid.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(100);
    await left.click();
    await expect.poll(() => grid.evaluate((el) => el.scrollLeft)).toBe(0);

    // Drag a noninteractive answer cell, without relying on an overlay scrollbar.
    await alex.scrollIntoViewIfNeeded();
    const bounds = (await grid.boundingBox())!;
    const rowBounds = (await alex.boundingBox())!;
    const x = bounds.x + bounds.width - 70;
    const y = rowBounds.y + rowBounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 180, y, { steps: 12 });
    await expect
      .poll(() => grid.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(100);
    await expect(page.locator(".swipe-contact")).toBeVisible();
    await page.mouse.up();
    await expect(page.locator(".swipe-contact")).toHaveCount(0);
    await grid.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await grid.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => grid.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await grid.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(right).toBeDisabled();
    await expect(left).toBeEnabled();
    const memberAfter = await alex
      .locator(".response-member-cell")
      .boundingBox();
    expect(Math.abs(memberAfter!.x - memberBefore!.x)).toBeLessThan(2);
    await expect(
      alex.getByRole("cell", {
        name: "Excited for the trip! I can help with camp setup.",
        exact: true,
      }),
    ).toBeVisible();
    await capture(page, info.project.name, "response-answers");
  }
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await expect(
    page.getByText("Questions are locked because this form has responses.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /add question/i }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.goto(base + "/form/2");
  await page
    .getByRole("combobox", { name: "Response status" })
    .selectOption("no_response");
  const sam = page.getByRole("row").filter({ hasText: "Sam Taylor" });
  await sam.getByRole("button", { name: "Cancel signup", exact: true }).click();
  await capture(page, info.project.name, "cancel-signup");
  await page.getByRole("button", { name: "Keep signup" }).click();
  await expect(sam).toBeVisible();
  await sam.getByRole("button", { name: "Cancel signup", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel signup", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Sam Taylor" }),
  ).toHaveCount(0);
  const columns = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "status", header: "Signup status" },
    { key: "response_status", header: "Response status" },
    { key: "question:gear", header: "Gear needed" },
  ];
  let sheet = {
    configured: false,
    workbook_configured: true,
    enabled: false,
    revision: null as number | null,
    columns,
    catalog: columns,
    spreadsheet_url: null,
    preview: [
      [
        "Alex Morgan",
        "alex@example.com",
        "Active",
        "Responded",
        "Sleeping bag",
      ],
    ],
  };
  await page.route(
    `**/api/admin/events/${fixture.event_forms.event_id}/forms/1/google-sheet`,
    async (route) => {
      if (route.request().method() === "PUT")
        sheet = {
          ...sheet,
          ...route.request().postDataJSON(),
          configured: true,
          revision: 1,
        };
      await route.fulfill({ json: sheet });
    },
  );
  await page.goto(base + "/form/1?tab=google-sheets");
  await expect(
    page.getByRole("button", { name: "Enable form sync" }),
  ).toBeVisible();
  await capture(page, info.project.name, "google-sheets");
  await page.getByRole("button", { name: "Enable form sync" }).click();
  await expect(page.getByText("Sync enabled", { exact: true })).toBeVisible();
});

test("event forms stay compact below signup across responsive layouts", async ({
  page,
  context,
}, info) => {
  await identity(context, "Form member");
  await page.goto(fixture.event_forms.url);
  const forms = page.getByRole("region", { name: "Event forms", exact: true });
  const signup = page.locator(".signup-panel");
  await expect(forms.getByRole("listitem")).toHaveCount(2);
  await expect(
    forms.getByRole("list", { name: "Responded forms" }),
  ).toBeHidden();
  await expect(forms.locator("summary")).toHaveText("Responded (2)");
  await expect(forms.getByText("Not open yet", { exact: true })).toBeVisible();
  await expect(forms.getByText(/^Opens /)).toBeVisible();
  await expect(
    forms.getByRole("list", { name: "Pending forms" }).getByText(/^Due /),
  ).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  const viewports = [page.viewportSize()!];
  if (info.project.name === "desktop") {
    viewports.push(
      ...[360, 1023, 1024].map((width) => ({ width, height: 900 })),
    );
  }
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    const signupBox = (await signup.boundingBox())!;
    const formsBox = (await forms.boundingBox())!;
    expect(formsBox.y).toBeGreaterThanOrEqual(signupBox.y + signupBox.height);
    expect(Math.abs(formsBox.x - signupBox.x)).toBeLessThan(1);
    expect(Math.abs(formsBox.width - signupBox.width)).toBeLessThan(1);
    // The four original cards occupied at least 845px at these device sizes.
    expect(formsBox.height).toBeLessThan(507);
    expect(
      await forms.evaluate((el) =>
        Boolean(
          document.querySelector(".signup-panel")!.compareDocumentPosition(el) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const link of await forms.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await forms.scrollIntoViewIfNeeded();
    const scrolledSignup = (await signup.boundingBox())!;
    expect((await forms.boundingBox())!.y).toBeGreaterThanOrEqual(
      scrolledSignup.y + scrolledSignup.height,
    );
  }
  await page.setViewportSize(viewports[0]);
  await capture(page, info.project.name, "compact-event-page");
  await page.getByRole("button", { name: "Save Signup", exact: true }).focus();
  await page.keyboard.press("Tab");
  const complete = forms.getByRole("link", {
    name: "Complete form for Yosemite gear check",
    exact: true,
  });
  await expect(complete).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`${fixture.event_forms.url}/form/1$`),
  );
  await expect(
    page.getByRole("heading", { name: "Yosemite gear check", exact: true }),
  ).toBeVisible();
});

test("event form list handles long titles, optional forms, empty results and nonparticipants", async ({
  page,
  context,
}, info) => {
  await identity(context, "Form member");
  const endpoint = `**/api/events/${fixture.event_forms.event_id}/forms`;
  const longTitle =
    "Yosemite packing and transportation details — " + "LongTitle".repeat(12);
  await page.route(endpoint, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.items[0].title = longTitle;
    data.items[0].required = false;
    await route.fulfill({ response, json: data });
  });
  await page.goto(fixture.event_forms.url);
  const forms = page.getByRole("region", { name: "Event forms", exact: true });
  await expect(
    forms.getByRole("heading", { name: longTitle, exact: true }),
  ).toBeVisible();
  await expect(forms.getByText("Required", { exact: true })).toHaveCount(3);
  await expect(
    forms.getByRole("link", {
      name: `Complete form for ${longTitle}`,
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, info.project.name, "compact-long-title");
  await page.unroute(endpoint);
  await page.route(endpoint, (route) => route.fulfill({ json: { items: [] } }));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save Signup", exact: true }),
  ).toBeVisible();
  await expect(forms).toHaveCount(0);
  await page.unroute(endpoint);
  await identity(context, "Member");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yosemite Fall Retreat", exact: true }),
  ).toBeVisible();
  await expect(forms).toHaveCount(0);
});

test("responded forms collapse by default and expand with the keyboard", async ({
  page,
  context,
}, info) => {
  await identity(context, "Form late");
  const endpoint = `**/api/events/${fixture.event_forms.event_id}/forms`;
  let show: "all" | "pending" | "responded" = "all";
  await page.route(endpoint, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (show !== "all")
      data.items = data.items.filter((form: { response: unknown }) =>
        show === "responded" ? !!form.response : !form.response,
      );
    await route.fulfill({ response, json: data });
  });
  await page.goto(fixture.event_forms.url);
  const forms = page.getByRole("region", { name: "Event forms", exact: true });
  const summary = forms.locator("summary");
  const responded = forms.getByRole("list", { name: "Responded forms" });
  await expect(summary).toHaveText("Responded (3)");
  await expect(responded).toBeHidden();
  await expect(forms.getByRole("listitem")).toHaveCount(1);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(responded).toBeVisible();
  await expect(responded.getByRole("listitem")).toHaveCount(3);
  await expect(
    responded.getByText("Responded late", { exact: true }),
  ).toBeVisible();
  await capture(page, info.project.name, "responded-forms-expanded");
  await summary.focus();
  await page.keyboard.press("Space");
  await expect(responded).toBeHidden();
  await expect(
    forms.getByRole("list", { name: "Pending forms" }),
  ).toBeVisible();
  await summary.click();
  await responded
    .getByRole("link", {
      name: "Edit response for Yosemite gear check",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit response", exact: true }),
  ).toBeVisible();
  show = "responded";
  await page.goto(fixture.event_forms.url);
  await expect(summary).toHaveText("Responded (3)");
  await expect(responded).toBeHidden();
  await expect(forms.getByRole("list", { name: "Pending forms" })).toHaveCount(
    0,
  );
  show = "pending";
  await page.reload();
  await expect(
    forms.getByRole("list", { name: "Pending forms" }),
  ).toBeVisible();
  await expect(summary).toHaveCount(0);
});
