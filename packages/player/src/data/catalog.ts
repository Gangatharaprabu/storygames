import { Catalog, type CatalogEntry } from "@storygames/pack-spec";

/** Where published stories live: same site for now, a CDN later. Paths are relative to it. */
export const packUrl = (path: string) => new URL(path, new URL("packs/", location.href.split("#")[0])).href;

let pending: Promise<Catalog> | undefined;

export function loadCatalog(): Promise<Catalog> {
  pending ??= fetch(packUrl("catalog.json"), { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`could not load the story list (${r.status})`);
      return r.json();
    })
    .then((json) => Catalog.parse(json))
    .catch((e) => {
      pending = undefined;
      throw e;
    });
  return pending;
}

/** Other episodes of the same series, in order. */
export function episodesOf(stories: CatalogEntry[], story: CatalogEntry): CatalogEntry[] {
  if (!story.series) return [];
  return stories.filter((s) => s.series?.id === story.series!.id).sort((a, b) => a.series!.episode - b.series!.episode);
}

export function nextEpisode(stories: CatalogEntry[], story: CatalogEntry): CatalogEntry | undefined {
  const eps = episodesOf(stories, story);
  return eps[eps.findIndex((s) => s.id === story.id) + 1];
}
