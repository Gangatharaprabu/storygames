import { Catalog, type StoryPack, type CatalogCharacter, type CatalogEntry, type CatalogSeries } from "@storygames/pack-spec";

export interface CatalogInput {
  /** Path of the pack's folder, relative to where the catalog lives (e.g. `the-last-ferry/`). */
  folder: string;
  pack: StoryPack;
  publishedAt: string;
}

/**
 * The stories, series and characters the app shows, from a set of packs.
 * Every path in the result is relative to where the catalog will live.
 */
export function buildCatalog(inputs: CatalogInput[], seriesInfo: Array<{ id: string; title: string; synopsis: string }>): Catalog {
  const stories: CatalogEntry[] = [];
  const characters = new Map<string, CatalogCharacter>();

  for (const { folder, pack, publishedAt } of inputs) {
    const m = pack.manifest;
    const start = pack.scenes.find((s) => s.id === pack.startScene)!;
    stories.push({
      id: m.id,
      version: m.version,
      title: m.title,
      synopsis: m.synopsis,
      series: m.series,
      tags: m.tags,
      estimatedMinutes: m.estimatedMinutes,
      minEngine: m.minEngine,
      pack: folder,
      cover: `${folder}${m.cover ?? start.background}`,
      cast: pack.cast.map((member) => {
        const c = pack.characters.find((x) => x.id === member.character)!;
        return { id: c.id, name: c.name, role: member.role, portrait: `${folder}${c.portraits[c.defaultExpression]}` };
      }),
      continuesFrom: [...new Set([...m.follows, ...Object.values(pack.imports).map((i) => i.from)])],
      publishedAt,
    });
    for (const c of pack.characters) {
      const existing = characters.get(c.id);
      const portrait = `${folder}${c.portraits[c.defaultExpression]}`;
      // The most recently built story with a bio decides how the character is described.
      characters.set(c.id, {
        id: c.id,
        name: c.name,
        bio: c.bio ?? existing?.bio ?? "",
        color: c.color,
        portrait: existing?.portrait ?? portrait,
        stories: [...(existing?.stories ?? []), m.id],
      });
    }
  }

  // Series episodes in order, then standalone stories by title.
  stories.sort((a, b) =>
    (a.series?.title ?? a.title).localeCompare(b.series?.title ?? b.title) || (a.series?.episode ?? 0) - (b.series?.episode ?? 0),
  );
  const order = new Map(stories.map((s, i) => [s.id, i]));

  // Series: described by their series.json when there is one, otherwise by their episodes.
  const described = new Map(seriesInfo.map((s) => [s.id, s]));
  const series = new Map<string, CatalogSeries>();
  for (const s of stories) {
    if (!s.series) continue;
    const info = described.get(s.series.id);
    const entry = series.get(s.series.id) ?? {
      id: s.series.id,
      title: info?.title ?? s.series.title,
      synopsis: info?.synopsis ?? "",
      stories: [],
      branchesFrom: [],
    };
    entry.stories.push(s.id);
    series.set(s.series.id, entry);
  }
  const byId = new Map(stories.map((s) => [s.id, s]));
  for (const entry of series.values()) {
    const inside = new Set(entry.stories);
    entry.branchesFrom = [
      ...new Set(entry.stories.flatMap((id) => byId.get(id)!.continuesFrom).filter((id) => !inside.has(id) && byId.has(id))),
    ];
  }

  // Originals before spin-offs: a series comes after the series it branches from.
  const seriesOf = new Map(stories.filter((s) => s.series).map((s) => [s.id, s.series!.id]));
  const depthCache = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    if (depthCache.has(id)) return depthCache.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = series.get(id)!.branchesFrom.map((sid) => seriesOf.get(sid)).filter((p): p is string => Boolean(p) && p !== id);
    const d = parents.length ? 1 + Math.max(...parents.map((p) => depth(p, seen))) : 0;
    depthCache.set(id, d);
    return d;
  };
  const rank = (s: CatalogEntry) => (s.series ? depth(s.series.id) : Number.MAX_SAFE_INTEGER);
  stories.sort((a, b) => rank(a) - rank(b) || (a.series?.title ?? a.title).localeCompare(b.series?.title ?? b.title) || (a.series?.episode ?? 0) - (b.series?.episode ?? 0));
  stories.forEach((s, i) => order.set(s.id, i));
  const orderedSeries = [...series.values()].sort((a, b) => order.get(a.stories[0]!)! - order.get(b.stories[0]!)!);

  return Catalog.parse({
    catalogFormat: 1,
    generatedAt: new Date().toISOString(),
    stories,
    series: orderedSeries,
    characters: [...characters.values()]
      .map((c) => ({ ...c, stories: c.stories.sort((a, b) => order.get(a)! - order.get(b)!) }))
      .sort((a, b) => b.stories.length - a.stories.length || a.name.localeCompare(b.name)),
  });
}
