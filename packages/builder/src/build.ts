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
import { DialogueFile, dialogueToInk } from "./dialogue.ts";
import { LibraryCharacter, Puzzle, Scene, StorySource, Theme } from "./source.ts";

/**
 * A folder of source files: on disk (the CLI), or drafts in the Studio.
 * Paths use "/" and are relative to the folder.
 */
export interface SourceFolder {
  text(path: string): Promise<string | undefined>;
  exists(path: string): Promise<boolean>;
  /** Every file whose path starts with `prefix` (e.g. "scenes/"). */
  list(prefix: string): Promise<string[]>;
}

export interface AssetCopy {
  /** Path inside the pack, as the pack references it. */
  path: string;
  /** Where the file comes from. */
  from: { folder: "story" | "library"; path: string };
  /** Backgrounds get extra checks (aspect ratio, resolution) when converted. */
  kind: "background" | "image";
}

export interface PackBuild {
  ok: boolean;
  /** The validated pack, when ok. Asset paths are as written in the source. */
  pack?: StoryPack;
  /** Files to copy next to pack.json, when ok. */
  assets: AssetCopy[];
  errors: Problem[];
  warnings: Problem[];
}

const ext = (p: string) => /\.[^./]+$/.exec(p)?.[0] ?? "";
const base = (p: string) => p.split("/").pop()!;

/** Story source folder + character library → Story Pack (plus the list of files it needs). */
export async function buildPack(src: { story: SourceFolder; library: SourceFolder }): Promise<PackBuild> {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const fail = (path: string, message: string): PackBuild => ({ ok: false, assets: [], errors: [...errors, { path, message }], warnings });

  let story: z.infer<typeof StorySource>;
  let theme: z.infer<typeof Theme>;
  try {
    story = await readJson(src.story, "story.json", StorySource);
    theme = await readJson(src.story, "theme.json", Theme);
  } catch (e) {
    return fail("story", (e as Error).message);
  }

  const scenes = await readFolder(src.story, "scenes/", Scene, errors);
  const puzzles = await readFolder(src.story, "puzzles/", Puzzle, errors);

  // Characters: snapshot the chosen variant of each cast member from the library.
  const characters: CharacterSnapshot[] = [];
  const portraitCopies: AssetCopy[] = [];
  for (const member of story.cast) {
    const dir = `characters/${member.character}/`;
    let lib: z.infer<typeof LibraryCharacter>;
    try {
      lib = await readJson(src.library, `${dir}character.json`, LibraryCharacter);
    } catch (e) {
      errors.push({ path: `cast.${member.character}`, message: (e as Error).message });
      continue;
    }
    const variant = lib.variants[member.variant];
    if (!variant) {
      errors.push({ path: `cast.${member.character}`, message: `no variant "${member.variant}" in the library` });
      continue;
    }
    const copy = (files: Record<string, string>, prefix: string) => {
      const out: Record<string, string> = {};
      for (const [expr, file] of Object.entries(files)) {
        const to = `characters/${lib.id}/${prefix}${expr}${ext(file)}`;
        out[expr] = to;
        portraitCopies.push({ path: to, from: { folder: "library", path: dir + file }, kind: "image" });
      }
      return out;
    };
    const portraits = copy(variant.portraits, "");
    const sprites = copy(variant.sprites, "sprite-");
    characters.push({ id: lib.id, name: lib.name, bio: lib.bio, color: lib.color, variant: member.variant, defaultExpression: variant.defaultExpression, portraits, sprites });
  }

  const ink = await compileNarrative(src.story, story.narrative, story.flags, errors, warnings);
  if (errors.length || !ink) return { ok: false, assets: [], errors, warnings };

  const input: StoryPackInput = {
    manifest: {
      packFormat: PACK_FORMAT,
      id: story.id,
      version: story.version,
      title: story.title,
      synopsis: story.synopsis ?? "",
      series: story.series,
      tags: story.tags,
      follows: story.follows,
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

  const result = validatePack(input);
  warnings.push(...result.warnings);
  if (!result.ok) return { ok: false, assets: [], errors: result.errors, warnings };

  // Every referenced asset must exist.
  const assets: AssetCopy[] = [];
  const backgrounds = new Set(input.scenes.map((sc) => sc.background));
  const seen = new Set<string>();
  for (const path of collectAssetPaths(input)) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (!(await src.story.exists(path))) errors.push({ path, message: "file not found" });
    else assets.push({ path, from: { folder: "story", path }, kind: backgrounds.has(path) ? "background" : "image" });
  }
  for (const copy of portraitCopies) {
    if (!(await src.library.exists(copy.from.path))) errors.push({ path: `library/${copy.from.path}`, message: "file not found" });
    else assets.push(copy);
  }
  if (errors.length) return { ok: false, assets: [], errors, warnings };
  return { ok: true, pack: result.pack, assets, errors, warnings };
}

/**
 * The story's ink: hand-written (narrative/<entry>, if present) plus conversations made in
 * the Studio (narrative/dialogue.json, if present), compiled together.
 */
async function compileNarrative(
  folder: SourceFolder,
  entry: string,
  flags: Record<string, import("@storygames/pack-spec").FlagValue>,
  errors: Problem[],
  warnings: Problem[],
) {
  const files = new Map<string, string>();
  for (const path of await folder.list("narrative/")) {
    if (path.endsWith(".ink")) files.set(path.slice("narrative/".length), (await folder.text(path))!);
  }
  let source = files.get(entry) ?? "";
  const where = files.has(entry) ? `narrative/${entry}` : "narrative/dialogue.json";

  const dialogueRaw = await folder.text("narrative/dialogue.json");
  if (dialogueRaw !== undefined) {
    let parsed: DialogueFile;
    try {
      const r = DialogueFile.safeParse(JSON.parse(dialogueRaw));
      if (!r.success) {
        r.error.issues.forEach((i) => errors.push({ path: `narrative/dialogue.json ${i.path.join(".")}`, message: i.message }));
        return null;
      }
      parsed = r.data;
    } catch (e) {
      errors.push({ path: "narrative/dialogue.json", message: `invalid JSON (${(e as Error).message})` });
      return null;
    }
    const declared = new Set([...source.matchAll(/^\s*VAR\s+(\w+)/gm)].map((m) => m[1]!));
    const generated = dialogueToInk(parsed, flags, declared);
    generated.problems.forEach((p) => errors.push({ path: `narrative/dialogue.json ${p.path}`, message: p.message }));
    if (generated.problems.length) return null;
    source = source ? `${source}\n\n${generated.ink}` : generated.ink;
  }
  if (!source.trim()) {
    errors.push({ path: `narrative/${entry}`, message: "the story has no dialogue (no ink file and no dialogue.json)" });
    return null;
  }

  const inkErrors: string[] = [];
  const options = new CompilerOptions(
    entry,
    [],
    false,
    (message, type) => {
      // ErrorType: 0 author note, 1 warning, 2 error
      if (type === 2) inkErrors.push(message);
      else warnings.push({ path: where, message });
    },
    {
      // Lets ink `INCLUDE other.ink` resolve inside the narrative folder.
      ResolveInkFilename: (name: string) => name,
      LoadInkFileContents: (name: string) => files.get(name) ?? "",
    },
  );
  const compiled = new Compiler(source, options).Compile();
  if (inkErrors.length || !compiled) {
    inkErrors.forEach((message) => errors.push({ path: where, message }));
    return null;
  }
  const knots = [...compiled.mainContentContainer.namedContent.keys()].filter((k) => k !== "global decl");
  return { ink: compiled.ToJson() as string, knots };
}

/** Every story-relative file a pack refers to. */
export function collectAssetPaths(pack: StoryPackInput): string[] {
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

/** The pack with asset paths swapped (e.g. art/x.png → art/x.webp after conversion). */
export function renameAssets(pack: StoryPack, renamed: Map<string, string>): StoryPack {
  if (!renamed.size) return pack;
  return JSON.parse(JSON.stringify(pack, (_k, v) => (typeof v === "string" && renamed.has(v) ? renamed.get(v) : v)));
}

export async function readJson<T>(folder: SourceFolder, path: string, schema: z.ZodType<T>): Promise<T> {
  const text = await folder.text(path);
  if (text === undefined) throw new Error(`missing ${path}`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${base(path)}: invalid JSON (${(e as Error).message})`);
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new Error(`${base(path)}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
  }
  return r.data;
}

async function readFolder<T>(folder: SourceFolder, prefix: string, schema: z.ZodType<T>, errors: Problem[]): Promise<T[]> {
  const out: T[] = [];
  const names = (await folder.list(prefix)).filter((n) => n.endsWith(".json") && !n.slice(prefix.length).includes("/")).sort();
  for (const path of names) {
    try {
      out.push(await readJson(folder, path, schema));
    } catch (e) {
      errors.push({ path, message: (e as Error).message });
    }
  }
  return out;
}

/** Files held in memory (path → text or bytes), e.g. the Studio's drafts or tests. */
export function memoryFolder(files: Map<string, string | Uint8Array>): SourceFolder {
  return {
    async text(path) {
      const f = files.get(path);
      return f === undefined ? undefined : typeof f === "string" ? f : new TextDecoder().decode(f);
    },
    async exists(path) {
      return files.has(path);
    },
    async list(prefix) {
      return [...files.keys()].filter((p) => p.startsWith(prefix)).sort();
    },
  };
}
