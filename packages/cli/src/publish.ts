import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { publishPack, SeriesSource, type Channel, type ObjectStore } from "@storygames/builder";
import type { z } from "zod";
import { buildStory, type BuildResult } from "./build.ts";

export { CHANNELS, promote, PublishError, rollback, status, unpublish, type Channel } from "@storygames/builder";

/** Build a story from disk and publish it (see publishPack). */
export async function publish(opts: {
  store: ObjectStore;
  storyDir: string;
  libraryDir: string;
  /** Folders searched for series.json files. */
  seriesRoots: string[];
  channel?: Channel;
  log?: (line: string) => void;
}): Promise<{ build: BuildResult; story?: string; version?: string }> {
  const out = mkdtempSync(join(tmpdir(), "sg-publish-"));
  try {
    const build = await buildStory({ storyDir: opts.storyDir, libraryDir: opts.libraryDir, outDir: out });
    if (!build.ok) return { build };
    const files = listFiles(out)
      .filter((f) => f !== "pack.json")
      .map((path) => ({ path, body: readFileSync(join(out, path)) }));
    const r = await publishPack({ store: opts.store, pack: build.pack!, files, series: findSeries(opts.seriesRoots), channel: opts.channel, log: opts.log });
    return { build, ...r };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

export function findSeries(roots: string[]) {
  const found = new Map<string, z.infer<typeof SeriesSource>>();
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n.startsWith(".") || n === "node_modules") continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === "series.json") {
        const s = SeriesSource.parse(JSON.parse(readFileSync(p, "utf8")));
        found.set(s.id, s);
      }
    }
  };
  roots.forEach((r) => {
    try {
      walk(r);
    } catch {
      /* missing folder: no series there */
    }
  });
  return [...found.values()];
}

function listFiles(dir: string): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  return walk(dir).map((f) => relative(dir, f).split(sep).join("/")).sort();
}
