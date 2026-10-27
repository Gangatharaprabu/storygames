import type { CatalogEntry } from "@storygames/pack-spec";

/**
 * Matches every word of the query against title, synopsis, series, tags and character
 * names (case- and accent-insensitive). Title matches rank first.
 */
export function searchStories(stories: CatalogEntry[], query: string, tags: string[] = []): CatalogEntry[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  const scored: Array<{ story: CatalogEntry; score: number }> = [];
  for (const story of stories) {
    if (tags.length && !tags.every((t) => story.tags.includes(t))) continue;
    const title = normalise(story.title);
    const rest = normalise(
      [story.synopsis, story.series?.title ?? "", story.tags.join(" "), story.cast.map((c) => c.name).join(" ")].join(" "),
    );
    let score = 0;
    let all = true;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (rest.includes(w)) score += 1;
      else all = false;
    }
    if (all) scored.push({ story, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.story);
}

export function allTags(stories: CatalogEntry[]): string[] {
  return [...new Set(stories.flatMap((s) => s.tags))].sort();
}

function normalise(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");
}
