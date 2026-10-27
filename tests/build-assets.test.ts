// Integration: the build converts raster art to WebP and points the pack at the new files.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, expect, it } from "vitest";
import { buildStory } from "../packages/cli/src/build.ts";

const dir = mkdtempSync(join(tmpdir(), "sg-build-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

it("converts PNG art to WebP, scales it to the canvas and warns about odd backgrounds", async () => {
  const story = join(dir, "story");
  cpSync("fixtures/test-story", story, { recursive: true });
  // A big, landscape PNG background, like a raw AI render.
  await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#336699" } }).png().toFile(join(story, "art/harbour.png"));
  const scene = join(story, "scenes/harbour.json");
  writeFileSync(scene, readFileSync(scene, "utf8").replace("art/harbour.svg", "art/harbour.png"));

  const out = join(dir, "out");
  const result = await buildStory({ storyDir: story, libraryDir: "fixtures/library", outDir: out });
  expect(result.errors).toEqual([]);
  expect(result.warnings.map((w) => w.message)).toContainEqual(expect.stringMatching(/9:16/));

  const pack = JSON.parse(readFileSync(join(out, "pack.json"), "utf8"));
  const harbour = pack.scenes.find((s: { id: string }) => s.id === "harbour");
  expect(harbour.background).toBe("art/harbour.webp");
  expect(existsSync(join(out, "art/harbour.png"))).toBe(false);
  const meta = await sharp(join(out, "art/harbour.webp")).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.width).toBeLessThanOrEqual(1080);
  // SVGs are copied as they are.
  expect(existsSync(join(out, "art/at-sea.svg"))).toBe(true);
});
