import { describe, expect, it } from "vitest";
import type { Catalog, CatalogEntry } from "../packages/pack-spec/src/index.ts";
import { ProfileStore, percentDone, type ProfileBackend, type ProfileData } from "../packages/player/src/data/profile.ts";
import { searchCharacters, searchSeries, searchStories } from "../packages/player/src/data/search.ts";
import { continuationsOf, nextEpisode, parentSeriesOf, spinOffsOf } from "../packages/player/src/data/catalog.ts";

const story = (id: string, title: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  version: "1.0.0",
  title,
  synopsis: "",
  tags: [],
  estimatedMinutes: 5,
  minEngine: "0.1.0",
  pack: `${id}/`,
  cover: `${id}/cover.png`,
  cast: [],
  continuesFrom: [],
  publishedAt: "2026-01-01T00:00:00Z",
  ...extra,
});

const stories = [
  story("ferry", "The Last Ferry", {
    synopsis: "Mira crosses to the island.",
    tags: ["cosy"],
    series: { id: "mira", title: "Mira's Journey", episode: 1 },
    cast: [{ id: "tomo", name: "Tomo", role: "npc", portrait: "p.svg" }],
  }),
  story("lighthouse", "The Island Lighthouse", { tags: ["cosy", "mystery"], series: { id: "mira", title: "Mira's Journey", episode: 2 } }),
  story("clocks", "The Clockmaker’s Shop", { tags: ["mystery"], synopsis: "Every clock stopped." }),
];

describe("searchStories", () => {
  it("matches titles, synopsis, characters, series and tags", () => {
    expect(searchStories(stories, "ferry").map((s) => s.id)).toEqual(["ferry"]);
    expect(searchStories(stories, "tomo").map((s) => s.id)).toEqual(["ferry"]);
    expect(searchStories(stories, "mira's journey").map((s) => s.id)).toEqual(["ferry", "lighthouse"]);
    expect(searchStories(stories, "CLOCKMAKER'S").map((s) => s.id)).toEqual(["clocks"]); // curly vs straight apostrophe
  });

  it("needs every word, and ranks title matches first", () => {
    expect(searchStories(stories, "island ferry").map((s) => s.id)).toEqual(["ferry"]);
    expect(searchStories(stories, "island").map((s) => s.id)).toEqual(["lighthouse", "ferry"]);
  });

  it("filters by tags", () => {
    expect(searchStories(stories, "", ["mystery"]).map((s) => s.id)).toEqual(["lighthouse", "clocks"]);
    expect(searchStories(stories, "", ["cosy", "mystery"]).map((s) => s.id)).toEqual(["lighthouse"]);
  });
});

it("finds the next episode of a series", () => {
  expect(nextEpisode(stories, stories[0]!)?.id).toBe("lighthouse");
  expect(nextEpisode(stories, stories[1]!)).toBeUndefined();
  expect(nextEpisode(stories, stories[2]!)).toBeUndefined();
});

describe("ProfileStore", () => {
  const memory = (): ProfileBackend & { data?: ProfileData } => {
    const b: ProfileBackend & { data?: ProfileData } = {
      load: () => b.data,
      save: (d) => {
        b.data = structuredClone(d);
      },
    };
    return b;
  };

  it("saves stories, tracks progress, finishing and the saga", () => {
    const backend = memory();
    const store = new ProfileStore(backend);
    store.toggleSaved("ferry");
    expect(store.isSaved("ferry")).toBe(true);

    store.recordProgress("ferry", 40);
    store.addPlaytime("ferry", 30);
    expect(store.get().progress.ferry).toMatchObject({ status: "playing", percent: 40, secondsPlayed: 30 });

    store.finish("ferry", { helped_ferryman: true });
    expect(store.get().progress.ferry).toMatchObject({ status: "finished", percent: 100, timesFinished: 1 });
    expect(store.get().saga.ferry).toEqual({ helped_ferryman: true });

    // Playing again, then giving up, leaves it finished.
    store.recordProgress("ferry", 10);
    expect(store.get().progress.ferry!.status).toBe("playing");
    store.abandon("ferry");
    expect(store.get().progress.ferry!.status).toBe("finished");

    // Everything survives a reload.
    const reloaded = new ProfileStore(backend);
    expect(reloaded.isSaved("ferry")).toBe(true);
    expect(reloaded.get().saga.ferry).toEqual({ helped_ferryman: true });
  });

  it("renames, keeps the profile on reset, and notifies listeners", () => {
    const store = new ProfileStore(memory());
    let calls = 0;
    store.subscribe(() => calls++);
    store.rename("  Ganga  ");
    store.rename("   "); // ignored
    expect(store.get().profile.name).toBe("Ganga");
    store.toggleSaved("clocks");
    store.resetAll();
    expect(store.get().saved).toEqual({});
    expect(store.get().profile.name).toBe("Ganga");
    expect(calls).toBe(3);
  });
});

it("estimates progress from scenes and puzzles", () => {
  expect(percentDone({ visited: ["a"], solved: [] }, { scenes: 2, puzzles: 2 })).toBe(25);
  expect(percentDone({ visited: [], solved: [] }, { scenes: 0, puzzles: 0 })).toBe(0);
});

describe("series that branch into new series", () => {
  const spinOff = story("watch", "Hana's Night Watch", {
    series: { id: "tales", title: "Lighthouse Tales", episode: 1 },
    continuesFrom: ["lighthouse"],
  });
  const all = [...stories.map((s) => (s.id === "lighthouse" ? { ...s, continuesFrom: ["ferry"] } : s)), spinOff];
  const catalog: Catalog = {
    catalogFormat: 1,
    generatedAt: "",
    stories: all,
    series: [
      { id: "mira", title: "Mira's Journey", synopsis: "", stories: ["ferry", "lighthouse"], branchesFrom: [] },
      { id: "tales", title: "Lighthouse Tales", synopsis: "Nights with Hana.", stories: ["watch"], branchesFrom: ["lighthouse"] },
    ],
    characters: [
      { id: "hana", name: "Hana", bio: "Keeper of the lighthouse.", color: "#f00", portrait: "h.svg", stories: ["lighthouse", "watch"] },
      { id: "tomo", name: "Tomo", bio: "The old ferryman.", color: "#0f0", portrait: "t.svg", stories: ["ferry", "watch"] },
    ],
  };

  it("finds what happens next, inside and outside the series", () => {
    expect(continuationsOf(all, "ferry").map((s) => s.id)).toEqual(["lighthouse"]);
    expect(continuationsOf(all, "lighthouse").map((s) => s.id)).toEqual(["watch"]);
    expect(continuationsOf(all, "clocks")).toEqual([]);
  });

  it("links a spin-off series to the series it came from, both ways", () => {
    expect(spinOffsOf(catalog, catalog.series[0]!).map((s) => s.id)).toEqual(["tales"]);
    expect(spinOffsOf(catalog, catalog.series[1]!)).toEqual([]);
    expect(parentSeriesOf(catalog, catalog.series[1]!).map((p) => [p.story.id, p.series?.id])).toEqual([["lighthouse", "mira"]]);
  });

  it("searches characters and series", () => {
    expect(searchCharacters(catalog.characters, "hana").map((c) => c.id)).toEqual(["hana"]);
    expect(searchCharacters(catalog.characters, "ferryman").map((c) => c.id)).toEqual(["tomo"]);
    expect(searchCharacters(catalog.characters, "")).toEqual([]);
    expect(searchSeries(catalog.series, "lighthouse").map((s) => s.id)).toEqual(["tales"]);
  });
});
