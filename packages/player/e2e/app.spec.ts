import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Use the copy-link fallback for sharing, so the test can read the link.
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
});

test("home shows series and standalone stories", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Featured" }).getByRole("link", { name: /Mira.s Journey/ })).toBeVisible();
  const series = page.getByRole("region", { name: "Mira's Journey" });
  await expect(series.getByRole("link", { name: /The Last Ferry/ })).toBeVisible();
  await expect(series.getByRole("link", { name: /The Island Lighthouse/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Short stories" }).getByRole("link", { name: /Clockmaker/ })).toBeVisible();
  // The spin-off series says where it came from.
  const spinOff = page.getByRole("region", { name: "Lighthouse Tales" });
  await expect(spinOff.getByText("Continues from")).toBeVisible();
  await expect(spinOff.getByRole("link", { name: "Mira's Journey" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Characters" }).getByRole("link", { name: "Hana" })).toBeVisible();
  await page.screenshot({ path: "test-results/app-01-home.png" });
});

test("search by title, character and tag", async ({ page }) => {
  await page.goto("/#/search");
  const box = page.getByRole("searchbox", { name: "Search stories" });
  await box.fill("tomo");
  await expect(page.getByRole("status")).toHaveText("2 stories"); // he is in two series
  await expect(page.locator(".grid").getByRole("link", { name: /The Last Ferry/ })).toBeVisible();
  await expect(page.locator('.characters [data-character="tomo"]')).toBeVisible();
  await box.fill("clock");
  await expect(page.getByRole("status")).toHaveText("1 story");
  await box.fill("");
  await page.getByRole("button", { name: "mystery" }).click();
  await expect(page.getByRole("status")).toHaveText("2 stories");
  await box.fill("nothing like this");
  await expect(page.getByRole("status")).toHaveText("Nothing matches.");
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

test("browse by character: from a story to the character, to their other stories", async ({ page }) => {
  await page.goto("/#/story/the-last-ferry");
  await page.locator('[data-character="tomo"]').click();
  await expect(page.getByRole("heading", { name: "Tomo", level: 1 })).toBeVisible();
  await expect(page.getByText("In 2 stories")).toBeVisible();
  await expect(page.getByText("Gruff, fair, and fond of his nets.")).toBeVisible();
  const series = page.getByRole("region", { name: "Series" });
  await expect(series.getByRole("link", { name: /Mira's Journey/ })).toBeVisible();
  await expect(series.getByRole("link", { name: /Lighthouse Tales/ })).toBeVisible();
  await page.screenshot({ path: "test-results/app-06-character.png" });
  await page.getByRole("region", { name: "Stories with Tomo" }).getByRole("link", { name: /Hana's Night Watch/ }).click();
  await expect(page.getByRole("heading", { name: "Hana's Night Watch" })).toBeVisible();
});

test("a sequel that starts a new series shows up on both sides", async ({ page }) => {
  await page.goto("/#/story/the-island-lighthouse");
  await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New series: Lighthouse Tales" })).toBeVisible();
  await page.getByRole("link", { name: "New series: Lighthouse Tales" }).click();

  await expect(page.getByRole("heading", { name: "Lighthouse Tales" })).toBeVisible();
  await expect(page.getByText("Nights on the island with Hana")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mira's Journey" })).toBeVisible();
  await page.screenshot({ path: "test-results/app-07-series.png" });

  await page.getByRole("link", { name: "Mira's Journey" }).click();
  await expect(page.getByRole("heading", { name: "Mira's Journey", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The story continues in" })).toBeVisible();
  await expect(page.locator('[data-series="lighthouse-tales"]')).toBeVisible();
  await page.getByRole("link", { name: "Start with episode 1" }).click();
  await expect(page.getByRole("heading", { name: "The Last Ferry" })).toBeVisible();
});

test("search finds characters and series too", async ({ page }) => {
  await page.goto("/#/search?q=hana");
  await expect(page.locator('.characters [data-character="hana"]')).toBeVisible();
  await page.getByRole("searchbox").fill("lighthouse tales");
  await expect(page.locator('[data-series="lighthouse-tales"]')).toBeVisible();
  await page.screenshot({ path: "test-results/app-08-search-series.png" });
});

test("back button returns to where you came from, or home from a shared link", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("region", { name: "Short stories" }).getByRole("link", { name: /Clockmaker/ }).click();
  await expect(page.getByRole("heading", { name: "The Clockmaker's Shop" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("region", { name: "Featured" })).toBeVisible();

  await page.goto("/#/character/hana");
  await page.reload();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test.describe("narrow desktop window (trackpad/mouse)", () => {
  test.use({ viewport: { width: 370, height: 770 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test("scrolling over the carousel or a row scrolls the page; sideways scrolls the row", async ({ page }) => {
    await page.goto("/#/");
    const track = page.locator(".featured-track");
    const box = (await track.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // A trackpad "vertical" swipe: mostly down, a little sideways.
    for (let i = 0; i < 5; i++) await page.mouse.wheel(4, 60);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    expect(await track.evaluate((e) => e.scrollLeft)).toBe(0);

    // A sideways swipe moves the strip, not the page.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const y = await page.evaluate(() => window.scrollY);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(80, 5);
    await expect.poll(() => track.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
  });
});
