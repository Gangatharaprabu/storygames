import type { DialogueFile, LibraryCharacter, SeriesSource, StorySource } from "@storygames/builder";
import type { Puzzle, Scene, Theme } from "@storygames/pack-spec";
import type { z } from "zod";
import type { StudioApi } from "./api.ts";

/*
 * Drafts in the bucket, laid out exactly like story folders in the repo, so the CLI can
 * build them too:
 *
 *   studio/stories/<id>/story.json, theme.json, scenes/*.json, puzzles/*.json,
 *                       narrative/dialogue.json (and/or main.ink), art/…, audio/…
 *   studio/library/characters/<id>/character.json, portraits/…, sprites/…
 *   studio/series/<id>.json
 */

export type StoryJson = z.input<typeof StorySource>;
export type CharacterJson = z.input<typeof LibraryCharacter>;
export type SeriesJson = z.input<typeof SeriesSource>;
export type SceneJson = z.input<typeof Scene>;
export type PuzzleJson = z.input<typeof Puzzle>;
export type ThemeJson = z.input<typeof Theme>;

export const STORIES = "studio/stories/";
export const LIBRARY = "studio/library/";
export const SERIES = "studio/series/";
export const storyRoot = (id: string) => `${STORIES}${id}/`;
export const characterRoot = (id: string) => `${LIBRARY}characters/${id}/`;

/** "The Last Ferry!" → "the-last-ferry" */
export function slug(text: string, sep = "-") {
  const s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^${sep}+|${sep}+$`, "g"), "");
  return s || "untitled";
}

/** An id not in `taken`: base, base-2, base-3… */
export function uniqueId(base: string, taken: Iterable<string>, sep = "-") {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}${sep}${i}`)) return `${base}${sep}${i}`;
}

export const DEFAULT_THEME: ThemeJson = {
  colors: { background: "#14121f", surface: "#24203a", text: "#f6efe6", muted: "#b9b0c9", accent: "#f2a65a", accentText: "#1d1a2f" },
  fonts: { body: "system-ui, sans-serif", display: "Georgia, 'Times New Roman', serif" },
  radius: 16,
};

/** A plain gradient to stand in for a scene's art until real art is added. */
export function placeholderArt(label: string, hue = Math.floor(Math.random() * 360)) {
  const esc = label.replace(/[<&>]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="hsl(${hue} 45% 32%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 40% 14%)"/>
  </linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <text x="540" y="960" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#fff" opacity="0.35">${esc}</text>
</svg>
`;
}

export interface StorySummary {
  id: string;
  title: string;
  synopsis?: string;
  series?: { id: string; title: string; episode: number };
  version: string;
}

export async function listStories(api: StudioApi): Promise<StorySummary[]> {
  const keys = await api.list(STORIES);
  const ids = [...new Set(keys.filter((k) => k.endsWith("/story.json") && k.split("/").length === 4).map((k) => k.split("/")[2]!))];
  const stories = await Promise.all(
    ids.map(async (id) => {
      const s = await api.json<StoryJson>(`${storyRoot(id)}story.json`).catch(() => undefined);
      return s ? { id, title: s.title, synopsis: s.synopsis, series: s.series, version: s.version } : { id, title: id, version: "?" };
    }),
  );
  return stories.sort((a, b) => (a.series?.title ?? a.title).localeCompare(b.series?.title ?? b.title) || (a.series?.episode ?? 0) - (b.series?.episode ?? 0));
}

/** A new story with one placeholder scene and an opening conversation, ready to preview. */
export async function createStory(api: StudioApi, title: string): Promise<string> {
  const existing = (await listStories(api)).map((s) => s.id);
  const id = uniqueId(slug(title), existing);
  const root = storyRoot(id);
  const story: StoryJson = {
    id,
    version: "0.1.0",
    title,
    synopsis: "",
    tags: [],
    estimatedMinutes: 5,
    cast: [],
    startScene: "opening",
    flags: {},
    items: [],
  };
  await api.put(`${root}art/opening.svg`, placeholderArt("Opening"));
  await api.putJson(`${root}theme.json`, DEFAULT_THEME);
  const scene: SceneJson = {
    id: "opening",
    title: "Opening",
    background: "art/opening.svg",
    layers: [],
    hotspots: [],
    onEnter: [
      { do: "title", text: title, ms: 2200 },
      { do: "dialogue", knot: "opening" },
    ],
  };
  await api.putJson(`${root}scenes/opening.json`, scene);
  const dialogue: DialogueFile = {
    conversations: [{ id: "opening", title: "Opening", steps: [{ type: "line", text: "Our story begins here." }] }],
  };
  await api.putJson(`${root}narrative/dialogue.json`, dialogue);
  await api.putJson(`${root}story.json`, story);
  return id;
}

export async function listCharacters(api: StudioApi): Promise<CharacterJson[]> {
  const keys = await api.list(`${LIBRARY}characters/`);
  const files = keys.filter((k) => k.endsWith("/character.json") && k.split("/").length === 5);
  const chars = await Promise.all(files.map((k) => api.json<CharacterJson>(k).catch(() => undefined)));
  return chars.filter((c): c is CharacterJson => Boolean(c)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCharacter(api: StudioApi, name: string): Promise<string> {
  const existing = (await listCharacters(api)).map((c) => c.id);
  const id = uniqueId(slug(name), existing);
  const character: CharacterJson = {
    id,
    name,
    color: `hsl(${Math.floor(Math.random() * 360)} 60% 70%)`,
    bio: "",
    variants: { default: { defaultExpression: "neutral", portraits: { neutral: "portraits/neutral.svg" }, sprites: {} } },
  };
  await api.put(`${characterRoot(id)}portraits/neutral.svg`, placeholderPortrait(name, character.color));
  await api.putJson(`${characterRoot(id)}character.json`, character);
  return id;
}

export function placeholderPortrait(name: string, color: string) {
  const initial = (name.trim()[0] ?? "?").toUpperCase().replace(/[<&>]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <circle cx="300" cy="260" r="150" fill="${color}"/>
  <path d="M90 600 Q100 430 300 420 Q500 430 510 600 Z" fill="${color}" opacity="0.8"/>
  <text x="300" y="300" text-anchor="middle" font-family="sans-serif" font-size="140" font-weight="700" fill="#14121f">${initial}</text>
</svg>
`;
}

export async function listSeries(api: StudioApi): Promise<SeriesJson[]> {
  const keys = (await api.list(SERIES)).filter((k) => k.endsWith(".json"));
  const all = await Promise.all(keys.map((k) => api.json<SeriesJson>(k).catch(() => undefined)));
  return all.filter((s): s is SeriesJson => Boolean(s)).sort((a, b) => a.title.localeCompare(b.title));
}
