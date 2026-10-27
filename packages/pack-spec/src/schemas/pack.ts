import { z } from "zod";
import { AssetPath, FlagValue, Id } from "./common.ts";
import { CastMember, CharacterSnapshot } from "./character.ts";
import { Puzzle } from "./puzzle.ts";
import { Scene } from "./scene.ts";
import { Theme } from "./theme.ts";

export const Item = z.object({
  id: Id,
  name: z.string(),
  description: z.string().optional(),
  icon: AssetPath,
});
export type Item = z.infer<typeof Item>;

export const Manifest = z.object({
  packFormat: z.number().int(),
  id: Id,
  /** Semver of this story. Published packs are immutable; fixes get a new version. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string(),
  synopsis: z.string().default(""),
  series: z.object({ id: Id, title: z.string(), episode: z.number().int().positive() }).optional(),
  /** Short labels for browsing and search, e.g. "cosy", "mystery". */
  tags: z.array(z.string()).default([]),
  /**
   * Stories this one carries on from: earlier episodes, or a story in another series
   * when this one starts a spin-off. (Stories it imports flags from count too.)
   */
  follows: z.array(Id).default([]),
  orientation: z.literal("portrait"),
  estimatedMinutes: z.number().positive(),
  /** Lowest engine version able to play this pack. */
  minEngine: z.string(),
  cover: AssetPath.optional(),
});
export type Manifest = z.infer<typeof Manifest>;

/** Everything a player needs to run one story. Produced by the CLI, read by the engine. */
export const StoryPack = z.object({
  manifest: Manifest,
  theme: Theme,
  cast: z.array(CastMember),
  characters: z.array(CharacterSnapshot),
  items: z.array(Item).default([]),
  scenes: z.array(Scene).min(1),
  puzzles: z.array(Puzzle).default([]),
  startScene: Id,
  /** Initial values of story flags. Ink VARs with the same name stay in sync with these. */
  flags: z.record(z.string(), FlagValue).default({}),
  /** Flags a sequel may import. Everything else is private to this story. */
  exports: z.array(z.string()).default([]),
  /** Flags this story reads from earlier stories, with defaults for players who skipped them. */
  imports: z
    .record(z.string(), z.object({ from: Id, default: FlagValue }))
    .default({}),
  narrative: z.object({
    /** Compiled ink JSON. */
    ink: z.string(),
    /** Knot names available to `dialogue` actions (filled in by the build). */
    knots: z.array(z.string()),
  }),
});
export type StoryPack = z.infer<typeof StoryPack>;
export type StoryPackInput = z.input<typeof StoryPack>;
