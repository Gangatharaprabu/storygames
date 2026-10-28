import { expect, test, type Page } from "@playwright/test";

/** Click through dialogue, picking the choice whose text matches `pick` when choices appear. */
async function finishDialogue(page: Page, pick?: RegExp) {
  const dialogue = page.getByTestId("dialogue");
  for (let i = 0; i < 30 && (await dialogue.isVisible()); i++) {
    const choice = pick ? dialogue.getByRole("button", { name: pick }) : null;
    if (choice && (await choice.isVisible())) await choice.click();
    else await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(dialogue).toBeHidden();
}

/** Open the story's page and press Play. */
async function start(page: Page, url = "/#/story/the-last-ferry") {
  await page.goto(url);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await skipOpening(page);
}

/** Tap through the scene's opening cinematic until the first line of dialogue. */
async function skipOpening(page: Page) {
  const dialogue = page.getByTestId("dialogue");
  const skip = page.getByTestId("skip-cue");
  for (let i = 0; i < 40 && !(await dialogue.isVisible()); i++) {
    // The cue can end mid-click, so don't wait long for the button.
    if (await skip.isVisible()) await skip.click({ timeout: 300 }).catch(() => {});
    else await page.waitForTimeout(50);
  }
  await expect(dialogue).toBeVisible();
}

async function setDials(page: Page, values: number[]) {
  for (const [i, v] of values.entries()) {
    for (let n = 0; n < v; n++) await page.getByRole("button", { name: `Dial ${i + 1} up` }).click();
  }
}

test("plays The Last Ferry to the end (help Tomo route)", async ({ page }) => {
  await start(page);
  await expect(page.getByText("The last light is leaving the harbour")).toBeVisible();
  await page.screenshot({ path: "test-results/01-arrival.png" });
  await finishDialogue(page);

  await page.getByRole("button", { name: "Tomo, the ferryman" }).click();
  await finishDialogue(page, /Offer to help/);

  // Inline puzzle inside the scene
  await page.getByRole("button", { name: "Tomo's tackle box" }).click();
  await expect(page.getByRole("dialog", { name: "Tackle Box" })).toBeVisible();
  await setDials(page, [7, 2]);
  await page.screenshot({ path: "test-results/02-inline-puzzle.png" });
  await page.getByRole("button", { name: "Try it" }).click();
  await finishDialogue(page);
  await expect(page.getByRole("list", { name: "Inventory" }).getByRole("img", { name: "Coil of rope" })).toBeVisible();

  await page.getByRole("button", { name: "Tomo, the ferryman" }).click();
  await finishDialogue(page);
  await page.getByRole("button", { name: "The old lantern" }).click();
  await finishDialogue(page);

  // Full-screen puzzle, with a hint
  await page.getByRole("button", { name: "The chained ferry" }).click();
  await page.getByRole("button", { name: "Need a hint?" }).click();
  await expect(page.getByText("Someone around the harbour knows the code.")).toBeVisible();
  await page.getByRole("button", { name: "Try it" }).click();
  await expect(page.getByText("It doesn't budge.")).toBeVisible();
  await setDials(page, [3, 1, 4]);
  await page.screenshot({ path: "test-results/03-fullscreen-puzzle.png" });
  await page.getByRole("button", { name: "Try it" }).click();

  await expect(page.getByText(/chain falls away/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Safe crossing, Mira!")).toBeVisible();
  await page.screenshot({ path: "test-results/04-farewell.png" });
  await finishDialogue(page);
  await expect(page.getByText("The End")).toBeVisible();
  await expect(page.getByRole("link", { name: "Next: The Island Lighthouse" })).toBeVisible();
  await page.screenshot({ path: "test-results/05-end.png" });
});

test("resumes after a reload", async ({ page }) => {
  await start(page);
  await finishDialogue(page);
  await page.getByRole("button", { name: "Tomo, the ferryman" }).click();
  await finishDialogue(page, /Insist/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Noticeboard" })).toBeAttached();
  await expect(page.getByTestId("dialogue")).toBeHidden();
});

test.describe("phone held sideways", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("asks the player to turn the phone upright", async ({ page }) => {
    await page.goto("/#/play/the-last-ferry");
    await expect(page.getByText("Turn your phone upright to play.")).toBeVisible();
  });
});

test("shows tap markers on hotspots only when the scene is interactive", async ({ page }) => {
  await start(page);
  const marker = page.locator('[data-hotspot="tomo"] .sg-hotspot-marker');
  await expect(marker).toBeHidden();
  await finishDialogue(page);
  await expect(marker).toBeVisible();
});

test.describe("typewriter", () => {
  test.use({ reducedMotion: "no-preference" });

  test("first tap finishes the line, second tap moves on", async ({ page }) => {
    await page.goto("/#/play/the-last-ferry");
    await skipOpening(page);
    const typed = page.locator(".sg-line");
    const untyped = page.locator(".sg-untyped");
    await expect(untyped).not.toHaveText(""); // still typing
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(untyped).toHaveText("");
    await expect(typed).toContainText("The last light is leaving the harbour.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator(".sg-speaker")).toHaveText("Mira");
  });
});

test("debug panel jumps between scenes", async ({ page }) => {
  await start(page, "/?debug#/story/the-last-ferry");
  await page.getByRole("button", { name: "Open debug panel" }).click();
  await expect(page.getByRole("complementary", { name: "Debug panel" })).toBeVisible();
  await page.screenshot({ path: "test-results/06-debug.png" });
  await page.getByRole("button", { name: "Crossing" }).click();
  await expect(page.getByText(/chain falls away/)).toBeVisible();
  await page.getByRole("button", { name: "Skip dialogue" }).click();
  await expect(page.getByText("The End")).toBeVisible();
});

test("the debug panel is hidden from players", async ({ page }) => {
  await start(page);
  await expect(page.getByRole("button", { name: "Open debug panel" })).toHaveCount(0);
});

test("the opening plays like an anime scene: title, camera pan, Mira walks in", async ({ page }) => {
  await page.goto("/#/story/the-last-ferry");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".sg-letterbox[data-on]")).toBeAttached();
  await expect(page.getByRole("status").filter({ hasText: "The Last Ferry" })).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: "test-results/10-title-card.png" });
  // Mira walks on from the left once the camera has panned down.
  await expect(page.locator('.sg-actor[data-actor="mira"]')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: "test-results/11-mira-on-stage.png" });
  // While she's on stage she speaks from the scene, not from a close-up portrait.
  const miraLine = page.getByText("If I miss the ferry tonight");
  for (let i = 0; i < 4 && !(await miraLine.isVisible()); i++) await page.getByRole("button", { name: "Continue" }).click();
  await expect(miraLine).toBeVisible();
  await expect(page.locator(".sg-portrait")).toHaveCount(0);
  await finishDialogue(page);
  // She leaves, the bars lift, and it's the player's turn.
  await expect(page.locator('.sg-actor[data-actor="mira"]')).toHaveCount(0);
  await expect(page.locator(".sg-letterbox[data-on]")).toHaveCount(0);
  await expect(page.getByText("Tap around to explore")).toBeVisible();
  await page.screenshot({ path: "test-results/12-your-turn.png" });
  await expect(page.getByRole("button", { name: "Tomo, the ferryman" })).toBeEnabled();
});
