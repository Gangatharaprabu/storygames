import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// The local Studio API writes here (see playwright.config.ts).
const storage = resolve(import.meta.dirname, "../../../.storage-e2e");

// One story, written step by step: each test carries on from the last.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => rmSync(storage, { recursive: true, force: true }));

/** A small 9:16 red picture. */
const RED_PNG = "iVBORw0KGgoAAAANSUhEUgAAAFoAAACgCAIAAAADw+wqAAAA5klEQVR4nO3QQQ0AIBDAMISd/yCLHxIYjyYTsHTtGd1WfvBVOHDgwIEDBw4cOHD04cCBAwcOHDhw4MDRhwMHDhw4cODAgQNHHw4cOHDgwIEDBw4cfThw4MCBAwcOHDhw9OHAgQMHDhw4cODA0YcDBw4cOHDgwIEDRx8OHDhw4MCBAwcOHH04cODAgQMHDhw4cPThwIEDBw4cOHDgwNGHAwcOHDhw4MCBA0cfDhw4cODAgQMHDhx9OHDgwIEDBw4cOHD04cCBAwcOHDhw4MDRhwMHDhw4cODAgQNHHw4cOHDgwIEDx6sOaX1UG/ufGvkAAAAASUVORK5CYII=";

/** The next prompt() gets this answer. */
const answer = (page: Page, text: string) => page.once("dialog", (d) => void d.accept(text));

test("write a story from scratch, play it, publish it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No stories yet.")).toBeVisible();

  // A character for the library.
  await page.getByRole("link", { name: "Characters" }).click();
  answer(page, "Aki");
  await page.getByRole("button", { name: "+ New" }).click();
  await expect(page.getByRole("heading", { name: "Aki" })).toBeVisible();
  await page.getByRole("textbox", { name: "New expression" }).fill("happy");
  await page.getByRole("button", { name: "Add expression" }).click();
  await expect(page.getByText("happy portrait")).toBeVisible();

  // A new story.
  await page.getByRole("link", { name: "Stories" }).click();
  await page.getByRole("button", { name: "+ New story" }).click();
  await page.getByRole("textbox", { name: "Title" }).fill("The Lost Kite");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "The Lost Kite" })).toBeVisible();
  await page.getByRole("combobox", { name: "Add to cast" }).selectOption({ label: "Aki" });
  await expect(page.locator(".st-cast-member")).toContainText("Aki");

  // A flag and an item.
  await page.getByRole("link", { name: "Flags & items" }).click();
  await page.getByRole("textbox", { name: "New flag" }).fill("found kite");
  await page.getByRole("button", { name: "Add flag" }).click();
  await expect(page.getByText("found_kite")).toBeVisible();
  await page.getByRole("textbox", { name: "New item" }).fill("Red kite");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("textbox", { name: "Item name" })).toHaveValue("Red kite");

  // Dialogue: the opening, then a conversation for the tree.
  await page.getByRole("link", { name: "Dialogue" }).click();
  await page.getByRole("textbox", { name: "Line" }).first().fill("Wind howls over the hill.");
  await page.getByRole("button", { name: "+ Line" }).click();
  await page.getByRole("textbox", { name: "Line" }).nth(1).fill("My kite! Where did it go?");
  answer(page, "The tree");
  await page.getByRole("button", { name: "+ New conversation" }).click();
  await page.getByRole("textbox", { name: "Line" }).first().fill("Something red is caught in the branches.");
  await page.getByRole("button", { name: "+ Choice" }).click();
  await page.getByRole("textbox", { name: "Choice" }).first().fill("Climb up");
  await page.getByRole("textbox", { name: "Choice" }).nth(1).fill("Leave it");
  // Inside "Climb up": a line, then the item.
  const climb = page.locator(".st-option").first();
  await climb.getByRole("button", { name: "+ Line" }).click();
  await climb.getByRole("textbox", { name: "Line" }).fill("Got it!");
  await climb.getByRole("combobox", { name: "More" }).selectOption("give");
  await climb.getByRole("combobox", { name: "More" }).selectOption("set");

  // A hotspot on the opening scene that starts that conversation.
  await page.getByRole("link", { name: "Scenes" }).click();
  const canvas = page.getByTestId("scene-canvas");
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("textbox", { name: "What the player sees (label)" }).fill("The old tree");
  await page.getByRole("combobox", { name: "Add a step" }).selectOption("dialogue");
  await page.locator(".st-action summary").first().click();
  await page.locator(".st-action-body select").first().selectOption("the_tree");
  await expect(page.locator(".st-action-text").first()).toHaveText("Conversation “the_tree”");
  // …and then the story ends.
  await page.getByRole("combobox", { name: "Add a step" }).selectOption("end");
  await expect(page.locator(".st-action-text").nth(1)).toHaveText("The end");
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();

  // Real art: a PNG background is converted to WebP on upload.
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByTestId("upload-Background").setInputFiles({ name: "hill.png", mimeType: "image/png", buffer: Buffer.from(RED_PNG, "base64") });
  await expect(page.getByText(/only 90 pixels wide/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();
  const scene = JSON.parse(readFileSync(resolve(storage, "studio/stories/the-lost-kite/scenes/opening.json"), "utf8"));
  expect(scene.background).toMatch(/^art\/opening-\w+\.webp$/);

  // Play it in the Studio.
  await page.getByRole("link", { name: "Play" }).click();
  const preview = page.getByTestId("preview");
  await expect(preview.getByText("Wind howls over the hill.")).toBeVisible({ timeout: 10000 });
  await preview.getByRole("button", { name: "Continue" }).click();
  await expect(preview.getByText("My kite! Where did it go?")).toBeVisible();
  await preview.getByRole("button", { name: "Continue" }).click();
  await preview.getByRole("button", { name: "The old tree" }).click();
  await expect(preview.getByText("Something red is caught")).toBeVisible();
  await preview.getByRole("button", { name: "Climb up" }).click();
  await expect(preview.getByText("Got it!")).toBeVisible();
  await expect(preview.getByRole("list", { name: "Inventory" }).getByRole("img", { name: "Red kite" })).toBeVisible();
  await page.screenshot({ path: "test-results/studio-play.png" });
  await preview.getByRole("button", { name: "Continue" }).click();
  await expect(preview.getByRole("dialog", { name: "The end" })).toBeVisible();

  // Publish to staging, then live.
  await page.getByRole("link", { name: "Publish" }).click();
  await page.getByRole("button", { name: "Publish 0.1.0 to staging" }).click();
  await expect(page.getByText("is on the staging site")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Make 0.1.0 live" }).click();
  await expect(page.getByText("0.1.0 is live")).toBeVisible();
  const live = JSON.parse(readFileSync(resolve(storage, "catalogs/live.json"), "utf8"));
  expect(live.stories.map((s: { id: string; version: string }) => [s.id, s.version])).toEqual([["the-lost-kite", "0.1.0"]]);
  expect(live.characters.map((c: { name: string }) => c.name)).toEqual(["Aki"]);
  expect(existsSync(resolve(storage, "packs/the-lost-kite/0.1.0/pack.json"))).toBe(true);

  // Changing it now needs a new version.
  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByRole("textbox", { name: "Title" }).fill("The Lost Red Kite");
  await page.getByRole("link", { name: "Publish" }).click();
  await expect(page.getByText("0.1.0 is already published")).toBeVisible();
  await page.getByRole("button", { name: "Use 0.1.1" }).click();
  await page.getByRole("button", { name: "Publish 0.1.1 to staging" }).click();
  await expect(page.getByText("0.1.1 is on the staging site")).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: "test-results/studio-publish.png" });
});

test("a story with problems can't be published, and says why", async ({ page }) => {
  await page.goto("/#/story/the-lost-kite/dialogue/the_tree");
  // Empty a line: the build refuses it.
  await page.getByRole("textbox", { name: "Line" }).first().fill("");
  await page.getByRole("link", { name: "Publish" }).click();
  await page.getByRole("button", { name: "Check for problems" }).click();
  await expect(page.getByText(/thing(s)? to fix/)).toBeVisible();
  await expect(page.locator(".st-problem-error").first()).toContainText("dialogue.json");
});
