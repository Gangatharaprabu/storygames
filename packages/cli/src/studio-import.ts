import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ObjectStore } from "@storygames/builder";
import { findSeries } from "./publish.ts";

/**
 * Copies a story folder from the repo into the Studio's drafts (studio/… in the store),
 * with the library characters in its cast and the series it belongs to. Existing drafts
 * with the same id are overwritten.
 */
export async function importToStudio(opts: {
  store: ObjectStore;
  storyDir: string;
  libraryDir: string;
  seriesRoots: string[];
  log?: (line: string) => void;
}): Promise<string> {
  const { store, log = () => {} } = opts;
  const story = JSON.parse(readFileSync(join(opts.storyDir, "story.json"), "utf8")) as {
    id: string;
    cast: Array<{ character: string }>;
    series?: { id: string };
  };
  const copy = async (dir: string, prefix: string) => {
    const files = walk(dir);
    for (const f of files) await store.put(prefix + relative(dir, f).split(sep).join("/"), readFileSync(f), "no-store");
    return files.length;
  };
  log(`  ${story.id}: ${await copy(opts.storyDir, `studio/stories/${story.id}/`)} files`);
  for (const { character } of story.cast) {
    log(`  character ${character}: ${await copy(join(opts.libraryDir, "characters", character), `studio/library/characters/${character}/`)} files`);
  }
  for (const s of findSeries(opts.seriesRoots)) {
    if (s.id !== story.series?.id) continue;
    await store.put(`studio/series/${s.id}.json`, JSON.stringify(s, null, 2), "no-store");
    log(`  series ${s.id}`);
  }
  return story.id;
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .filter((n) => !n.startsWith("."))
    .flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
}
