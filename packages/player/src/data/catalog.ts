import { Catalog, type CatalogEntry, type CatalogSeries } from "@storygames/pack-spec";

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

/** Stories that carry on from this one: the next episode, and sequels or spin-offs in other series. */
export function continuationsOf(stories: CatalogEntry[], id: string): CatalogEntry[] {
  return stories.filter((s) => s.continuesFrom.includes(id));
}

/** Series that branched off from any story in this series. */
export function spinOffsOf(catalog: Catalog, series: CatalogSeries): CatalogSeries[] {
  const inside = new Set(series.stories);
  return catalog.series.filter((s) => s.id !== series.id && s.branchesFrom.some((id) => inside.has(id)));
}

/** The series a story belongs to. */
export function seriesOf(catalog: Catalog, story: CatalogEntry): CatalogSeries | undefined {
  return story.series && catalog.series.find((s) => s.id === story.series!.id);
}

/** The series this series branched off from (through the stories it follows). */
export function parentSeriesOf(catalog: Catalog, series: CatalogSeries): Array<{ series?: CatalogSeries; story: CatalogEntry }> {
  return series.branchesFrom
    .map((id) => catalog.stories.find((s) => s.id === id))
    .filter((s): s is CatalogEntry => Boolean(s))
    .map((story) => ({ story, series: seriesOf(catalog, story) }));
}
