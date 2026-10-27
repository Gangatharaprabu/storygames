import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { Compiler, CompilerOptions } from "inkjs/full";
import {
  PACK_FORMAT,
  validatePack,
  type CharacterSnapshot,
  type Problem,
  type StoryPack,
  type StoryPackInput,
} from "@storygames/pack-spec";
import type { z } from "zod";
import { writeAssets, type AssetJob } from "./assets.ts";
import { LibraryCharacter, Puzzle, Scene, StorySource, Theme } from "./source.ts";

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

/**
 * Story source folder + character library → Story Pack.
 *
 * Output layout:
 *   pack.json                       the whole story (validated against pack-spec)
 *   art/…                           art the story references (PNG/JPG converted to WebP)
 *   characters/<id>/<expr>.<ext>    portraits of the cast, snapshotted from the library
 */
export async function buildStory(opts: BuildOptions): Promise<BuildResult> {
  const storyDir = resolve(opts.storyDir);
  const libraryDir = resolve(opts.libraryDir);
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const fail = (path: string, message: string): BuildResult => ({ ok: false, errors: [...errors, { path, message }], warnings });

  let story: z.infer<typeof StorySource>;
  let theme: z.infer<typeof Theme>;
  try {
    story = readJson(join(storyDir, "story.json"), StorySource);
    theme = readJson(join(storyDir, "theme.json"), Theme);
  } catch (e) {
    return fail(basename(storyDir), (e as Error).message);
  }

  const scenes = readFolder(join(storyDir, "scenes"), Scene, errors);
  const puzzles = readFolder(join(storyDir, "puzzles"), Puzzle, errors);

  // Characters: snapshot the chosen variant of each cast member from the library.
  const characters: CharacterSnapshot[] = [];
  const portraitCopies: Array<[from: string, to: string]> = [];
  for (const member of story.cast) {
    const dir = join(libraryDir, "characters", member.character);
    let lib: z.infer<typeof LibraryCharacter>;
    try {
      lib = readJson(join(dir, "character.json"), LibraryCharacter);
    } catch (e) {
      errors.push({ path: `cast.${member.character}`, message: (e as Error).message });
      continue;
    }
    const variant = lib.variants[member.variant];
    if (!variant) {
      errors.push({ path: `cast.${member.character}`, message: `no variant "${member.variant}" in the library` });
      continue;
    }
    const portraits: Record<string, string> = {};
    for (const [expr, file] of Object.entries(variant.portraits)) {
      const to = `characters/${lib.id}/${expr}${extname(file)}`;
      portraits[expr] = to;
      portraitCopies.push([join(dir, file), to]);
    }
    characters.push({ id: lib.id, name: lib.name, color: lib.color, variant: member.variant, defaultExpression: variant.defaultExpression, portraits });
  }

  const ink = compileInk(join(storyDir, "narrative"), story.narrative, errors, warnings);
  if (errors.length || !ink) return { ok: false, errors, warnings };

  const pack: StoryPackInput = {
    manifest: {
      packFormat: PACK_FORMAT,
      id: story.id,
      version: story.version,
      title: story.title,
      synopsis: story.synopsis ?? "",
      series: story.series,
      tags: story.tags,
      orientation: "portrait",
      estimatedMinutes: story.estimatedMinutes,
      minEngine: story.minEngine,
      cover: story.cover,
    },
    theme,
    cast: story.cast,
    characters,
    items: story.items,
    scenes,
    puzzles,
    startScene: story.startScene,
    flags: story.flags,
    exports: story.exports,
    imports: story.imports,
    narrative: ink,
  };

  const result = validatePack(pack);
  warnings.push(...result.warnings);
  if (!result.ok) return { ok: false, errors: result.errors, warnings };

  // Every referenced asset must exist.
  const jobs: AssetJob[] = [];
  const backgrounds = new Set(pack.scenes.map((sc) => sc.background));
  for (const path of collectAssetPaths(pack)) {
    if (path.startsWith("characters/")) continue;
    const from = join(storyDir, path);
    if (!existsSync(from)) errors.push({ path, message: "asset file not found" });
    else jobs.push({ from, path, kind: backgrounds.has(path) ? "background" : "image" });
  }
  for (const [from, to] of portraitCopies) {
    if (!existsSync(from)) errors.push({ path: from, message: "portrait file not found" });
    else jobs.push({ from, path: to, kind: "image" });
  }
  if (errors.length) return { ok: false, errors, warnings };

  let built = result.pack;
  if (opts.outDir) {
    const out = resolve(opts.outDir);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const renamed = await writeAssets(jobs, out, warnings);
    // Point the pack at converted files (art/x.png → art/x.webp).
    built = JSON.parse(JSON.stringify(built, (_k, v) => (typeof v === "string" && renamed.has(v) ? renamed.get(v) : v)));
    writeFileSync(join(out, "pack.json"), JSON.stringify(built));
  }
  return { ok: true, pack: built, errors, warnings };
}

function compileInk(dir: string, entry: string, errors: Problem[], warnings: Problem[]) {
  const file = join(dir, entry);
  if (!existsSync(file)) {
    errors.push({ path: `narrative/${entry}`, message: "ink file not found" });
    return null;
  }
  const inkErrors: string[] = [];
  const options = new CompilerOptions(file, [], false, (message, type) => {
    // ErrorType: 0 author note, 1 warning, 2 error
    if (type === 2) inkErrors.push(message);
    else warnings.push({ path: `narrative/${entry}`, message });
  }, {
    // Lets ink `INCLUDE other.ink` resolve relative to the narrative folder.
    ResolveInkFilename: (name: string) => resolve(dir, name),
    LoadInkFileContents: (name: string) => readFileSync(resolve(dir, name), "utf8"),
  });
  const story = new Compiler(readFileSync(file, "utf8"), options).Compile();
  if (inkErrors.length || !story) {
    inkErrors.forEach((message) => errors.push({ path: `narrative/${entry}`, message }));
    return null;
  }
  const knots = [...story.mainContentContainer.namedContent.keys()].filter((k) => k !== "global decl");
  return { ink: story.ToJson() as string, knots };
}

function collectAssetPaths(pack: StoryPackInput): string[] {
  const paths: string[] = [];
  if (pack.manifest.cover) paths.push(pack.manifest.cover);
  if (pack.theme.dialogueFrame) paths.push(pack.theme.dialogueFrame);
  paths.push(...Object.values(pack.theme.sounds ?? {}).filter((p): p is string => Boolean(p)));
  for (const s of pack.scenes) {
    paths.push(s.background);
    if (s.music) paths.push(s.music);
    s.layers?.forEach((l) => paths.push(l.image));
  }
  for (const p of pack.puzzles ?? []) paths.push(...Object.values(p.skin ?? {}));
  for (const i of pack.items ?? []) paths.push(i.icon);
  return paths;
}

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  if (!existsSync(file)) throw new Error(`missing ${basename(file)}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${basename(file)}: invalid JSON (${(e as Error).message})`);
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new Error(`${basename(file)}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
  }
  return r.data;
}

function readFolder<T>(dir: string, schema: z.ZodType<T>, errors: Problem[]): T[] {
  if (!existsSync(dir)) return [];
  const out: T[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    try {
      out.push(readJson(join(dir, name), schema));
    } catch (e) {
      errors.push({ path: `${basename(dir)}/${name}`, message: (e as Error).message });
    }
  }
  return out;
}
