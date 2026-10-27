import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Use the copy-link fallback for sharing, so the test can read the link.
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
});

test("home shows series and standalone stories", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Short stories you solve." })).toBeVisible();
  const series = page.getByRole("region", { name: "Mira's Journey" });
  await expect(series.getByRole("link", { name: /The Last Ferry/ })).toBeVisible();
  await expect(series.getByRole("link", { name: /The Island Lighthouse/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Short stories" }).getByRole("link", { name: /Clockmaker/ })).toBeVisible();
  await page.screenshot({ path: "test-results/app-01-home.png" });
});

test("search by title, character and tag", async ({ page }) => {
  await page.goto("/#/search");
  const box = page.getByRole("searchbox", { name: "Search stories" });
  await box.fill("tomo");
  await expect(page.getByRole("status")).toHaveText("1 story");
  await expect(page.locator(".grid").getByRole("link", { name: /The Last Ferry/ })).toBeVisible();
  await box.fill("");
  await page.getByRole("button", { name: "mystery" }).click();
  await expect(page.getByRole("status")).toHaveText("2 stories");
  await box.fill("nothing like this");
  await expect(page.getByRole("status")).toHaveText("No stories match.");
  await page.screenshot({ path: "test-results/app-02-search.png" });
});

test("save a story, then find it in My stories", async ({ page }) => {
  await page.goto("/#/story/the-clockmakers-shop");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "test-results/app-03-detail.png" });
  await page.getByRole("navigation", { name: "Main" }).last().getByRole("link", { name: "My stories" }).click();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /Clockmaker/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /Clockmaker/ })).toBeVisible();
});

test("leaving a story mid-way puts it in Continue, with progress", async ({ page }) => {
  await page.goto("/#/story/the-last-ferry");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Leave story" }).click();
  await expect(page).toHaveURL(/#\/story\/the-last-ferry/);
  await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
  await page.goto("/#/");
  const row = page.getByRole("region", { name: "Continue" });
  await expect(row.getByRole("link", { name: /The Last Ferry/ })).toBeVisible();
  await expect(row.getByRole("progressbar")).toBeVisible();
  await page.screenshot({ path: "test-results/app-04-continue.png" });
  // Continue picks up where we left off; the interrupted intro plays again from its start.
  await row.getByRole("link", { name: /The Last Ferry/ }).click();
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByText("The last light is leaving the harbour")).toBeVisible();
});

test("profile: rename, pick an avatar, it sticks", async ({ page }) => {
  await page.goto("/#/profile");
  const name = page.getByLabel("Your name");
  await name.fill("Ganga");
  await name.press("Enter");
  await page.getByRole("button", { name: "Change avatar" }).click();
  await page.getByRole("group", { name: "Avatars" }).getByRole("button", { name: "🦊" }).click();
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("Ganga");
  await expect(page.getByRole("button", { name: "Change avatar" })).toHaveText("🦊");
  await page.goto("/#/");
  await expect(page.getByText("Hello, Ganga")).toBeVisible();
  await page.goto("/#/profile");
  await page.screenshot({ path: "test-results/app-05-profile.png" });
});

test("share copies a link that opens the story", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#/story/the-island-lighthouse");
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#\/story\/the-island-lighthouse$/);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "The Island Lighthouse" })).toBeVisible();
  await expect(page.getByText(/Continues from/)).toBeVisible();
});

test("unknown story shows a friendly not-found page", async ({ page }) => {
  await page.goto("/#/story/nope");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
