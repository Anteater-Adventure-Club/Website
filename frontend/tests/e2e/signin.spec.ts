import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        member: null,
        officer: false,
        oauth_available: true,
        profile_complete: false,
      },
    }),
  );
  await page.route("**/api/quarters?*", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("**/api/site-settings", (route) =>
    route.fulfill({ json: { venmo: "", zelle: "", cash: "", discord: "" } }),
  );
  await page.route("**/api/page-metadata", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Sign In | AAC</title>",
    }),
  );
});

test("Sign-in prefers UCI and only the explicit exception selects non-UCI", async ({
  page,
}, info) => {
  const returnTo = "/events/trail-day/42?quarter=8&source=signup";
  const signIn = `/sign-in?return_to=${encodeURIComponent(returnTo)}&mode=non_uci&error=uci`;
  await page.goto(signIn);
  const uci = page.getByRole("link", { name: "Continue with UCI Google" });
  const other = page.getByRole("link", { name: "I don't have a UCI email" });
  await expect(uci).toBeVisible();
  await expect(uci).toHaveClass(/primary/);
  await expect(other).toHaveClass(/quiet/);
  await expect(page.getByRole("alert")).toContainText(
    "Use your verified UCI Google account",
  );
  await expect(page.getByText(/Use the same email each time/)).toBeVisible();
  expect((await uci.boundingBox())!.y).toBeLessThan(
    (await other.boundingBox())!.y,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("sign-in.png"),
    fullPage: true,
  });

  const attempts: URL[] = [];
  await page.route("**/api/auth/login?*", (route) => {
    attempts.push(new URL(route.request().url()));
    return route.fulfill({
      contentType: "text/html",
      body: "Starting Google sign-in",
    });
  });
  await uci.click();
  await expect(page).toHaveURL(/\/api\/auth\/login\?/);
  expect(attempts[0].searchParams.get("return_to")).toBe(returnTo);
  expect(attempts[0].searchParams.has("mode")).toBe(false);

  await page.goto(signIn);
  await other.focus();
  await expect(other).toBeFocused();
  await other.press("Enter");
  await expect(page).toHaveURL(/\/api\/auth\/login\?mode=non_uci/);
  expect(attempts[1].searchParams.get("return_to")).toBe(returnTo);
  expect(attempts[1].searchParams.get("mode")).toBe("non_uci");
});

test("Signed-in members continue to My AAC without choosing another account", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        member: { id: 42, name: "Returning Member", email: "member@gmail.com" },
        officer: false,
        oauth_available: true,
        profile_complete: false,
      },
    }),
  );
  await page.goto("/sign-in");
  await expect(
    page.getByRole("link", { name: "Continue to My AAC" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue with UCI Google" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "I don't have a UCI email" }),
  ).toHaveCount(0);
});
