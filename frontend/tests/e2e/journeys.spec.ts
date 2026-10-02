import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

let fixture: any;
const testURL = process.env.E2E_BASE_URL || "http://localhost:5173";
test.beforeEach(async ({ baseURL }) => {
  if (baseURL !== testURL || new URL(testURL).hostname !== "localhost")
    throw new Error("Mutating journeys require the isolated local application");
  execFileSync(process.env.E2E_PYTHON || "../.venv/bin/python", [
    "../scripts/seed-browser-fixtures.py",
  ]);
  fixture = JSON.parse(
    fs.readFileSync(path.resolve("../artifacts/browser-fixtures.json"), "utf8"),
  );
});
test.afterEach(async ({ page }, info) => {
  const directory = path.resolve(`../artifacts/journeys/${info.project.name}`);
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${info.title.split(" ")[0]}.png`),
    fullPage: true,
  });
});
async function identity(context: BrowserContext, role?: string) {
  await context.clearCookies();
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
const eventURL = (name: string, officer = false) =>
  `${officer ? "/admin" : ""}/events/${fixture.events[name].slug}/${fixture.events[name].id}`;
async function api(page: Page, url: string, method = "GET", body?: unknown) {
  const result = await page.request.fetch(url, {
    method,
    data: body,
    headers: { Origin: testURL },
  });
  expect(result.ok(), `${url}: ${await result.text()}`).toBeTruthy();
  return result.json();
}
const dialog = (page: Page) => page.getByRole("dialog").last();

test("J01 visitor links, event return path, board, and draft privacy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Anteater Adventure Club/i }).first(),
  ).toBeVisible();
  await page.goto("/events");
  await page.getByRole("button", { name: /Fixture Tide Pools/ }).click();
  await expect(
    dialog(page).getByRole("heading", {
      name: "Fixture Tide Pools",
      exact: true,
    }),
  ).toBeVisible();
  const galleryPhoto = dialog(page).getByRole("img");
  await expect(galleryPhoto).toBeVisible();
  await expect
    .poll(() =>
      galleryPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await dialog(page).getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const date = new Date(fixture.events.Adventure.starts_at).toLocaleDateString(
    "en-US",
    { timeZone: "America/Los_Angeles", month: "long", day: "numeric" },
  );
  await page.getByRole("button", { name: new RegExp(`^${date},`) }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fixture Adventure Signup",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(eventURL("Adventure"));
  const signIn = page.getByRole("link", { name: /Sign in/i }).last();
  await expect(signIn).toHaveAttribute("href", /return_to=/);
  await signIn.click();
  await expect(page).toHaveURL(/sign-in.*return_to=/);
  await page.goto("/board");
  await expect(page.getByText("Fixture Officer One").first()).toBeVisible();
  await page.locator(".board-grid .polaroid").first().click();
  await expect(
    dialog(page).getByRole("heading", {
      name: "Fixture Officer One",
      exact: true,
    }),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/membership");
  await expect(page.getByText("Our live reimbursement budget")).toBeVisible();
  const draft = await page.request.get(
    `/api/events/${fixture.events.Draft.id}`,
  );
  expect(draft.status()).toBe(404);
  await page.goto("/off-the-trail");
  await expect(
    page.getByRole("heading", { name: /Off the trail/i }),
  ).toBeVisible();
});

test("J02 profile, car, dues, approved membership, signup edit and cancellation", async ({
  page,
  context,
}) => {
  await identity(context, "General Rider");
  await page.goto("/my-aac/profile");
  await page.getByLabel("Discord handle").fill("fixture-browser-member");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page
    .getByRole("button", { name: /Add.*Car/i })
    .first()
    .click();
  await dialog(page).getByLabel("Year", { exact: true }).fill("2020");
  await dialog(page).getByLabel("Make", { exact: true }).fill("Toyota");
  await dialog(page).getByLabel("Model", { exact: true }).fill("Corolla");
  await dialog(page).getByRole("button", { name: "Save Car" }).click();
  await expect(page.getByText(/Toyota Corolla/).first()).toBeVisible();
  await page.goto("/membership");
  await page.getByLabel("I’ve sent my payment or paid an officer.").check();
  await page.getByRole("button", { name: /Submit for approval/ }).click();
  await expect(page.getByText("Pending confirmation")).toBeVisible();
  await identity(context, "officer");
  await page.goto("/admin/members?status=pending");
  await page.getByLabel("Search members").fill("Fixture General Rider");
  await page.getByRole("button", { name: "Confirm Dues" }).click();
  await dialog(page)
    .getByLabel("Reference", { exact: true })
    .fill("Browser external cash receipt");
  await dialog(page).getByRole("button", { name: "Confirm Payment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await identity(context, "General Rider");
  await page.goto("/membership");
  await expect(page.getByText("You’re part of the adventure!")).toBeVisible();
  await page.goto(eventURL("Adventure"));
  await page.getByRole("button", { name: "I can drive others!" }).click();
  await page.getByLabel("Which car?").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Sign up as a driver!" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re signed up!", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I have my own ride!" }).click();
  await page.getByRole("button", { name: "Save Signup", exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await api(page, `/api/me/signups?quarter_id=${fixture.quarter.id}`)
        ).items.find((s: any) => s.event_id === fixture.events.Adventure.id)
          .role,
    )
    .toBe("own");
  await page
    .getByRole("button", { name: "Cancel Signup", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Cancel Signup", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Sign me up!" })).toBeVisible();
  await page.goto("/my-aac/signups");
  await expect(
    page.getByRole("heading", {
      name: "Fixture Adventure Signup",
      exact: true,
    }),
  ).toBeVisible();
});

test("J03 quarter creation, unified event publication and duplication", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "New Quarter" }).click();
  await dialog(page).getByLabel("Quarter name").fill("Browser Future Quarter");
  const start = new Date();
  start.setDate(start.getDate() + 100);
  const end = new Date();
  end.setDate(end.getDate() + 160);
  const day = start.toISOString().slice(0, 10);
  await dialog(page).getByLabel("Starts on").fill(day);
  await dialog(page).getByLabel("Ends on").fill(end.toISOString().slice(0, 10));
  await dialog(page)
    .getByRole("button", { name: "Create Quarter", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const quarters = await api(page, "/api/admin/quarters");
  const quarter = quarters.items.find(
    (q: any) => q.name === "Browser Future Quarter",
  );
  await page.goto(`/admin/events/new?quarter=${quarter.id}`);
  await page
    .getByLabel("Event name", { exact: true })
    .fill("Browser Overnight Retreat");
  await page.getByLabel("Event type").selectOption("retreat");
  await page
    .getByLabel("Starts · Pacific", { exact: true })
    .fill(`${day}T10:00`);
  start.setDate(start.getDate() + 2);
  await page
    .getByLabel("Ends · Pacific", { exact: true })
    .fill(`${start.toISOString().slice(0, 10)}T17:00`);
  await page
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Browser Overnight Retreat",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Duplicate/i }).click();
  await dialog(page).getByRole("button", { name: "Create Draft Copy" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue(
    /Browser Overnight Retreat/,
  );
});

test("J04 dues exception and correction preserve receipt history", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/members?status=pending");
  await page.getByLabel("Search members").fill("Fixture Pending");
  await page.getByRole("button", { name: "Confirm Dues" }).click();
  await dialog(page)
    .getByLabel("Reference", { exact: true })
    .fill("Browser confirmed payment");
  await dialog(page).getByRole("button", { name: "Confirm Payment" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/admin/members");
  await page.getByLabel("Search members").fill("Fixture Pending");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: /Dues|Membership/ })
    .click();
  await dialog(page)
    .getByLabel("Membership category")
    .selectOption("exception");
  await dialog(page)
    .getByLabel("Notes / reason")
    .fill("Browser officer correction to a membership exception");
  await dialog(page)
    .getByRole("button", { name: "Approve $0 Exception" })
    .click();
  await expect
    .poll(
      async () =>
        (
          await api(
            page,
            `/api/admin/members/${fixture.people.Pending.id}?quarter_id=${fixture.quarter.id}`,
          )
        ).membership.source,
    )
    .toBe("exception");
  const detail = await api(
    page,
    `/api/admin/members/${fixture.people.Pending.id}?quarter_id=${fixture.quarter.id}`,
  );
  expect(
    detail.memberships.find((m: any) => m.quarter_id === fixture.quarter.id)
      .source,
  ).toBe("exception");
  expect(JSON.stringify(detail)).toContain("Browser confirmed payment");
});

test("J05 invalid imports are blocked and valid TSV rows apply once", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await dialog(page)
    .getByLabel("Spreadsheet rows")
    .fill("Name,Email,Phone\nInvalid,bad-address,9495550100");
  await dialog(page).getByRole("button", { name: "Preview Import" }).click();
  await expect(dialog(page).getByText(/Row 2:/)).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: /^Apply/ }),
  ).toHaveCount(0);
  await dialog(page)
    .getByLabel("Spreadsheet rows")
    .fill(
      "Name\tEmail\tPhone\nBrowser Import\tbrowserimport@uci.edu\t9495550100",
    );
  await dialog(page).getByRole("button", { name: "Preview Import" }).click();
  await dialog(page).getByRole("button", { name: "Apply 1 Rows" }).click();
  await expect(dialog(page).getByText("Import complete")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Search members").fill("Browser Import");
  await expect(page.getByText("Browser Import", { exact: true })).toHaveCount(
    1,
  );
});

test("J06 field arrival, live receipt, preserved seat assignments and undo", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto(eventURL("Field", true) + "/check-in");
  await page
    .getByRole("button", { name: /Fixture Member Paid Member/ })
    .click();
  await dialog(page).getByRole("button", { name: "Confirm Check In" }).click();
  await expect(
    dialog(page).getByRole("heading", { name: "Checked in!", exact: true }),
  ).toBeVisible();
  const state = await api(
    page,
    `/api/admin/events/${fixture.events.Field.id}/check-in`,
  );
  const member = state.signups.find(
    (s: any) => s.member_id === fixture.people.Member.id,
  );
  expect(member.checked_in_at).toBeTruthy();
  expect(member.card.category).toBe("paid");
  await page.goto(eventURL("Field", true) + "?tab=carpools");
  await page
    .getByRole("button", { name: "Fill the Rest", exact: true })
    .click();
  const filled = await api(
    page,
    `/api/admin/events/${fixture.events.Field.id}/check-in`,
  );
  expect(
    filled.signups.find((s: any) => s.id === fixture.signups["Paid Rider"].id)
      .driver_signup_id,
  ).toBe(fixture.signups.Driver.id);
  await page.goto(eventURL("Field", true) + "?tab=check-in-log");
  const memberRow = page
    .locator(".record-card")
    .filter({ hasText: "Fixture Member" })
    .first();
  await memberRow.getByRole("button", { name: /Undo/ }).click();
  await dialog(page).getByRole("button", { name: /Undo/ }).click();
  await expect
    .poll(
      async () =>
        (
          await api(
            page,
            `/api/admin/events/${fixture.events.Field.id}/check-in`,
          )
        ).signups.find((s: any) => s.id === member.id).checked_in_at,
    )
    .toBeNull();
});

test("J07 recap draft isolation, publication snapshot and unpublication", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto(eventURL("Completed", true) + "?tab=recap");
  await page.getByLabel("Polaroid title").fill("Browser Published Coast");
  await page
    .getByLabel("Caption", { exact: true })
    .fill("Browser coastal recap");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Recap saved.")).toBeVisible();
  let gallery = await api(page, "/api/gallery");
  expect(JSON.stringify(gallery)).not.toContain("Browser Published Coast");
  await page.getByRole("button", { name: "Publish to Gallery" }).click();
  await dialog(page)
    .getByRole("button", { name: "Publish Recap", exact: true })
    .click();
  await expect
    .poll(async () => JSON.stringify(await api(page, "/api/gallery")))
    .toContain("Browser Published Coast");
  await page.getByLabel("Polaroid title").fill("Browser Private Revision");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByText("Recap saved.")).toBeVisible();
  gallery = await api(page, "/api/gallery");
  expect(JSON.stringify(gallery)).toContain("Browser Published Coast");
  expect(JSON.stringify(gallery)).not.toContain("Browser Private Revision");
  await page
    .getByRole("button", { name: "Remove from Public Gallery", exact: true })
    .click();
  await expect
    .poll(async () => JSON.stringify(await api(page, "/api/gallery")))
    .not.toContain("Browser Published Coast");
});

test("J08 financial finalize, payment, archive and frozen history", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/reimbursements");
  await page.getByRole("button", { name: /4\s*Review/ }).click();
  await page
    .getByRole("button", { name: "Finalize Quarter", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Freeze Allocations" })
    .click();
  await expect(
    page.getByText("finalized", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /5\s*Pay/ }).click();
  await page
    .getByRole("button", { name: "Mark Paid", exact: true })
    .first()
    .click();
  await dialog(page)
    .getByLabel("Payment reference / confirmation")
    .fill("Browser external payout");
  await dialog(page)
    .getByRole("button", { name: "Record Full Payment" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Archive Quarter", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Archive Quarter", exact: true })
    .click();
  await expect(
    page.getByText("archived", { exact: true }).first(),
  ).toBeVisible();
  const history = await api(
    page,
    `/api/admin/quarters/${fixture.quarter.id}/reimbursements`,
  );
  expect(history.state).toBe("archived");
  expect(JSON.stringify(history)).toContain("Browser external payout");
  const rejected = await page.request.put(
    `/api/admin/quarters/${fixture.quarter.id}`,
    {
      headers: { Origin: "http://localhost:5173" },
      data: {
        name: fixture.quarter.name,
        starts_on: fixture.quarter.starts_on,
        ends_on: fixture.quarter.ends_on,
        budget: "900",
        driver_cap: fixture.quarter.driver_cap,
        mpg: fixture.quarter.mpg,
        expected_revision: fixture.quarter.revision,
      },
    },
  );
  expect(rejected.status()).toBe(409);
});

test("J09 new board profile, reorder, next term and explicit access revocation", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/officers");
  await page
    .getByRole("button", { name: "Add Board Profile", exact: true })
    .first()
    .click();
  await dialog(page)
    .getByLabel("Name", { exact: true })
    .fill("Browser Public Officer");
  await dialog(page)
    .getByLabel("Officer role", { exact: true })
    .fill("Adventure planner");
  await dialog(page)
    .getByRole("button", { name: /Save Profile/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser Public Officer" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move Browser Public Officer up" })
    .click();
  await page.getByRole("button", { name: "Start Next Board" }).click();
  await dialog(page).getByLabel("Board year label").fill("Browser Next Board");
  await dialog(page)
    .getByRole("button", { name: "Start Board", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let officers = await api(page, "/api/admin/officers");
  expect(officers.items).toHaveLength(2);
  const row = page
    .locator(".record-card")
    .filter({ hasText: "Fixture Officer Two" });
  await row.getByRole("button", { name: "Revoke Access" }).click();
  await dialog(page).getByRole("button", { name: "Revoke Access" }).click();
  await expect
    .poll(async () => (await api(page, "/api/admin/officers")).items.length)
    .toBe(1);
  await expect(dialog(page)).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revoke Access", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Revoke Access" }).click();
  await dialog(page).getByRole("button", { name: "Revoke Access" }).click();
  await expect(
    dialog(page).getByText(/Keep at least one officer/i),
  ).toBeVisible();
  officers = await api(page, "/api/admin/officers");
  expect(officers.items).toHaveLength(1);
});

test("J10 reuse a past profile preserves history, photo and sole officer access", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/officers");
  const terms = (await api(page, "/api/admin/board/terms")).items;
  const current = terms.find((t: any) => t.current);
  const past = terms.find((t: any) => !t.current);
  const previous = await api(page, `/api/admin/board/terms/${past.id}`);
  const before = await api(page, `/api/admin/board/terms/${current.id}`);
  const officers = (await api(page, "/api/admin/officers")).items;
  const owner = officers.find((o: any) => o.member_id === 1);
  const other = officers.find((o: any) => o.member_id !== 1);
  await api(page, `/api/admin/officers/${other.member_id}`, "DELETE");
  const imageResponse = await page.request.post("/api/admin/media", {
    headers: { Origin: testURL },
    multipart: {
      purpose: "board",
      file: {
        name: "board.webp",
        mimeType: "image/webp",
        buffer: fs.readFileSync(
          path.resolve("public/images/about_tide_pools.webp"),
        ),
      },
    },
  });
  expect(imageResponse.ok()).toBeTruthy();
  const photo = await imageResponse.json();
  const source = await api(
    page,
    `/api/admin/board/entries/${previous.entries[0].id}`,
    "PUT",
    {
      name: owner.name,
      role: "Treasurer",
      major: "Computer science · third year",
      bio: "Last year’s adventures.",
      memory: "Our coastal picnic.",
      instagram: "https://www.instagram.com/fixture/",
      photo_id: photo.id,
      palette: "lavender",
      visible: false,
      member_id: owner.member_id,
      site_access: true,
      position: 99,
      expected_revision: previous.entries[0].revision,
    },
  );
  await page.reload();
  async function prefill() {
    await page
      .getByRole("button", { name: "Add Board Profile", exact: true })
      .first()
      .click();
    await dialog(page)
      .getByRole("button", { name: "Use Existing Profile" })
      .click();
    await expect(dialog(page).getByLabel("Previous board year")).toHaveValue(
      String(past.id),
    );
    await dialog(page)
      .getByLabel("Existing board profile")
      .selectOption(String(source.id));
    await dialog(page)
      .getByRole("button", { name: "Use Profile", exact: true })
      .click();
  }
  await prefill();
  await expect(dialog(page).getByLabel("Name", { exact: true })).toHaveValue(
    source.name,
  );
  await expect(
    dialog(page).getByLabel("Officer role", { exact: true }),
  ).toHaveValue(source.role);
  await expect(dialog(page).getByLabel("Major / year")).toHaveValue(
    source.major,
  );
  await expect(dialog(page).getByLabel("About them")).toHaveValue(source.bio);
  await expect(dialog(page).getByLabel("Favorite AAC memory")).toHaveValue(
    source.memory,
  );
  await expect(dialog(page).getByLabel("Instagram profile URL")).toHaveValue(
    source.instagram,
  );
  await expect(
    dialog(page).getByRole("button", { name: "lavender palette" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog(page).getByLabel("Show on the public board"),
  ).not.toBeChecked();
  await expect(
    dialog(page).getByLabel("Grant officer site access"),
  ).toBeChecked();
  const preview = dialog(page).getByRole("img", {
    name: "Current cropped image",
  });
  await expect(preview).toHaveAttribute(
    "src",
    `/api/admin/media/${photo.id}?variant=medium`,
  );
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    dialog(page).getByText("An existing member is linked."),
  ).toBeVisible();
  await dialog(page).getByLabel("Grant officer site access").click();
  await expect(
    dialog(page).getByRole("heading", {
      name: "Remove site access when saving?",
    }),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Keep Access" }).click();
  await expect(
    dialog(page).getByLabel("Grant officer site access"),
  ).toBeChecked();
  await dialog(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await api(page, `/api/admin/board/terms/${current.id}`)).toEqual(
    before,
  );
  expect(
    (await api(page, `/api/admin/board/terms/${past.id}`)).entries,
  ).toEqual([source]);

  await prefill();
  await dialog(page)
    .getByLabel("Officer role", { exact: true })
    .fill("President");
  await dialog(page).getByLabel("About them").fill("This year’s adventures.");
  await dialog(page).getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await api(page, `/api/admin/board/terms/${current.id}`);
  expect(after.entries).toHaveLength(before.entries.length + 1);
  const copied = after.entries.at(-1);
  expect(copied.id).not.toBe(source.id);
  expect(copied).toMatchObject({
    ...source,
    id: copied.id,
    term_id: current.id,
    role: "President",
    bio: "This year’s adventures.",
    position: Math.max(...before.entries.map((e: any) => e.position)) + 1,
    revision: 1,
  });
  expect(
    (await api(page, `/api/admin/board/terms/${past.id}`)).entries,
  ).toEqual([source]);
  expect((await api(page, "/api/admin/officers")).items).toEqual([owner]);
  const row = page.locator(".board-edit-row").filter({
    has: page.getByRole("heading", { name: source.name, exact: true }),
  });
  await row.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await dialog(page)
    .getByLabel("Major / year")
    .fill("Computer science · fourth year");
  await dialog(page).getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await api(page, `/api/admin/board/terms/${current.id}`)).entries.at(-1)
      .major,
  ).toBe("Computer science · fourth year");
  expect(
    (await api(page, `/api/admin/board/terms/${past.id}`)).entries,
  ).toEqual([source]);
});

test("J11 existing-profile picker handles empty years, retry and unlinked profiles", async ({
  page,
  context,
}) => {
  await identity(context, "officer");
  await page.goto("/admin/officers");
  const terms = (await api(page, "/api/admin/board/terms")).items;
  const past = terms.find((t: any) => !t.current);
  const current = terms.find((t: any) => t.current);
  const previous = await api(page, `/api/admin/board/terms/${past.id}`);
  const source = previous.entries[0];
  await page.getByLabel(/^Board year/).selectOption(String(past.id));
  await page
    .getByRole("button", { name: "Add Board Profile", exact: true })
    .first()
    .click();
  await dialog(page)
    .getByRole("button", { name: "Use Existing Profile" })
    .click();
  await expect(
    dialog(page).getByRole("heading", { name: "No previous board years" }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Use Profile", exact: true }),
  ).toBeDisabled();
  await dialog(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();

  const empty = await api(page, "/api/admin/board/terms", "POST", {
    label: "Empty Board",
    start_year: current.start_year + 1,
  });
  const destination = await api(page, "/api/admin/board/terms", "POST", {
    label: "Destination Board",
    start_year: current.start_year + 2,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Add Board Profile", exact: true })
    .first()
    .click();
  await dialog(page).getByLabel("Name", { exact: true }).fill("Keep my draft");
  await dialog(page)
    .getByRole("button", { name: "Use Existing Profile" })
    .click();
  await expect(dialog(page).getByLabel("Previous board year")).toHaveValue(
    String(empty.id),
  );
  await expect(
    dialog(page).getByRole("heading", { name: "No profiles in this year" }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(dialog(page).getByLabel("Name", { exact: true })).toHaveValue(
    "Keep my draft",
  );
  await dialog(page)
    .getByRole("button", { name: "Use Existing Profile" })
    .click();
  const route = `**/api/admin/board/terms/${past.id}`;
  await page.route(route, (request) =>
    request.fulfill({
      status: 503,
      json: { detail: "Board temporarily unavailable" },
    }),
  );
  await dialog(page)
    .getByLabel("Previous board year")
    .selectOption(String(past.id));
  await expect(
    dialog(page).getByRole("button", { name: "Try again" }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Use Profile", exact: true }),
  ).toBeDisabled();
  await page.unroute(route);
  await dialog(page).getByRole("button", { name: "Try again" }).click();
  await dialog(page)
    .getByLabel("Existing board profile")
    .selectOption(String(source.id));
  await dialog(page)
    .getByLabel("Previous board year")
    .selectOption(String(empty.id));
  await expect(
    dialog(page).getByRole("button", { name: "Use Profile", exact: true }),
  ).toBeDisabled();
  await dialog(page)
    .getByLabel("Previous board year")
    .selectOption(String(past.id));
  await dialog(page)
    .getByLabel("Existing board profile")
    .selectOption(String(source.id));
  await dialog(page)
    .getByRole("button", { name: "Use Profile", exact: true })
    .click();
  await expect(dialog(page).getByLabel("Name", { exact: true })).toHaveValue(
    source.name,
  );
  await expect(dialog(page).getByText("No member linked.")).toBeVisible();
  await expect(
    dialog(page).getByLabel("Grant officer site access"),
  ).toBeDisabled();
  await expect(
    dialog(page).getByRole("img", { name: "Current cropped image" }),
  ).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const copied = (await api(page, `/api/admin/board/terms/${destination.id}`))
    .entries[0];
  expect(copied).toMatchObject({
    name: source.name,
    member_id: null,
    photo_id: null,
    site_access: false,
    position: 0,
  });
  expect(
    (await api(page, `/api/admin/board/terms/${past.id}`)).entries,
  ).toEqual([source]);
});
