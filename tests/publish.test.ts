// Integration: publishing to a store (a temp folder standing in for Cloudflare R2).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Catalog } from "../packages/pack-spec/src/index.ts";
import { promote, publish, PublishError, rollback, status, unpublish } from "../packages/cli/src/publish.ts";
import { localStore } from "../packages/cli/src/store.ts";

const tmp = mkdtempSync(join(tmpdir(), "sg-pub-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const store = localStore(join(tmp, "bucket"));
const catalog = (channel: string) => Catalog.parse(JSON.parse(readFileSync(join(tmp, "bucket", "catalogs", `${channel}.json`), "utf8")));
const pub = (storyDir: string) => publish({ store, storyDir, libraryDir: "fixtures/library", seriesRoots: ["fixtures"] });

/** A copy of the test story we can edit (title, version). */
function storyCopy(version: string, title = "The Last Ferry") {
  const dir = join(tmp, `ferry-${version}-${title.length}`);
  cpSync("fixtures/test-story", dir, { recursive: true });
  const file = join(dir, "story.json");
  const story = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...story, version, title }));
  return dir;
}

describe("publishing", () => {
  it("publishes to staging first; live only after promote", async () => {
    const r = await pub(storyCopy("1.0.0"));
    expect(r.build.ok).toBe(true);
    expect(catalog("staging").stories.map((s) => [s.id, s.version, s.pack])).toEqual([["the-last-ferry", "1.0.0", "packs/the-last-ferry/1.0.0/"]]);
    expect(await store.exists("catalogs/live.json")).toBe(false);

    await promote(store, "the-last-ferry");
    const live = catalog("live");
    expect(live.stories[0]!.version).toBe("1.0.0");
    // Paths in the catalog point inside the versioned folder, and the files are there.
    expect(live.stories[0]!.cover).toBe("packs/the-last-ferry/1.0.0/art/harbour.svg");
    expect(await store.exists(live.stories[0]!.cover)).toBe(true);
    expect(await store.exists(live.stories[0]!.cast[0]!.portrait)).toBe(true);
    // Series descriptions come along.
    expect(live.series.map((s) => s.title)).toEqual(["Mira's Journey"]);
    expect(live.series[0]!.synopsis).toMatch(/young traveller/);
  });

  it("re-publishing the same version is harmless; changing it without a new version is refused", async () => {
    expect((await pub(storyCopy("1.0.0"))).build.ok).toBe(true);
    await expect(pub(storyCopy("1.0.0", "The Very Last Ferry"))).rejects.toThrow(PublishError);
    await expect(pub(storyCopy("1.0.0", "The Very Last Ferry"))).rejects.toThrow(/raise the version.*1\.0\.1/);
  });

  it("a new version goes to staging while live keeps the old one; rollback works", async () => {
    await pub(storyCopy("1.1.0", "The Last Ferry (Remastered)"));
    expect(catalog("staging").stories[0]).toMatchObject({ version: "1.1.0", title: "The Last Ferry (Remastered)" });
    expect(catalog("live").stories[0]).toMatchObject({ version: "1.0.0", title: "The Last Ferry" });

    await promote(store, "the-last-ferry");
    expect(catalog("live").stories[0]!.version).toBe("1.1.0");

    await rollback(store, "the-last-ferry", "1.0.0");
    expect(catalog("live").stories[0]).toMatchObject({ version: "1.0.0", title: "The Last Ferry" });
    await expect(rollback(store, "the-last-ferry", "0.9.0")).rejects.toThrow(/never published.*1\.0\.0, 1\.1\.0/);

    expect(await status(store)).toEqual([{ story: "the-last-ferry", staging: "1.1.0", live: "1.0.0", versions: ["1.0.0", "1.1.0"] }]);
  });

  it("unpublish takes a story out of a channel but keeps its files", async () => {
    await unpublish(store, "the-last-ferry", "live");
    expect(catalog("live").stories).toEqual([]);
    expect(await store.exists("packs/the-last-ferry/1.0.0/pack.json")).toBe(true);
    await expect(promote(store, "nope")).rejects.toThrow(/isn't in staging/);
  });

  it("a broken story publishes nothing", async () => {
    const dir = storyCopy("2.0.0");
    writeFileSync(join(dir, "scenes", "broken.json"), JSON.stringify({ id: "broken", background: "art/missing.png" }));
    const r = await pub(dir);
    expect(r.build.ok).toBe(false);
    expect(await store.exists("packs/the-last-ferry/2.0.0/pack.json")).toBe(false);
  });
});
