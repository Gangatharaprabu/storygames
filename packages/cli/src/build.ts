import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { buildPack, renameAssets, type SourceFolder } from "@storygames/builder";
import type { Problem, StoryPack } from "@storygames/pack-spec";
import { writeAssets } from "./assets.ts";

export interface BuildOptions {
  storyDir: string;
  libraryDir: string;
  /** Omit to validate only. */
  outDir?: string;
}

export interface BuildResult {
  ok: boolean;
  /** The built pack, when ok. */
  pack?: StoryPack;
  errors: Problem[];
  warnings: Problem[];
}

/** A folder on disk, as the builder reads it. */
export function diskFolder(root: string): SourceFolder {
  const abs = resolve(root);
  const walk = (dir: string): string[] =>
    !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  return {
    async text(path) {
      const file = join(abs, path);
      return existsSync(file) && statSync(file).isFile() ? readFileSync(file, "utf8") : undefined;
    },
    async exists(path) {
      return existsSync(join(abs, path));
    },
    async list(prefix) {
      const dir = join(abs, prefix.replace(/\/[^/]*$/, ""));
      return walk(dir)
        .map((f) => relative(abs, f).split(sep).join("/"))
        .filter((p) => p.startsWith(prefix))
        .sort();
    },
  };
}

/**
 * Story source folder + character library → Story Pack.
 *
 * Output layout:
 *   pack.json                       the whole story (validated against pack-spec)
 *   art/…                           art the story references (PNG/JPG converted to WebP)
 *   characters/<id>/<expr>.<ext>    portraits of the cast, snapshotted from the library
 */
export async function buildStory(opts: BuildOptions): Promise<BuildResult> {
  const roots = { story: resolve(opts.storyDir), library: resolve(opts.libraryDir) };
  const built = await buildPack({ story: diskFolder(roots.story), library: diskFolder(roots.library) });
  const { errors, warnings } = built;
  if (!built.ok) return { ok: false, errors, warnings };

  let pack = built.pack!;
  if (opts.outDir) {
    const out = resolve(opts.outDir);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const jobs = built.assets.map((a) => ({ from: join(roots[a.from.folder], a.from.path), path: a.path, kind: a.kind }));
    // Point the pack at converted files (art/x.png → art/x.webp).
    pack = renameAssets(pack, await writeAssets(jobs, out, warnings));
    writeFileSync(join(out, "pack.json"), JSON.stringify(pack));
  }
  return { ok: true, pack, errors, warnings };
}
