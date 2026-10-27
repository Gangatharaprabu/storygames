import { z } from "zod";
import { CastMember, FlagValue, Id, Item, Puzzle, Scene, Theme } from "@storygames/pack-spec";

/**
 * Authoring formats: what you write in the content repo. The build turns these
 * into a Story Pack (pack-spec). Paths are relative to the file's own folder.
 */

/** library/characters/<id>/character.json — lives outside any story. */
export const LibraryCharacter = z.object({
  id: Id,
  name: z.string(),
  color: z.string(),
  bio: z.string().optional(),
  /** Each variant is one look (outfit, age…). Stories pick one. */
  variants: z.record(
    z.string(),
    z.object({
      defaultExpression: z.string(),
      portraits: z.record(z.string(), z.string()),
    }),
  ),
});

/** <story>/story.json */
export const StorySource = z.object({
  id: Id,
  version: z.string(),
  title: z.string(),
  synopsis: z.string().optional(),
  series: z.object({ id: Id, title: z.string(), episode: z.number().int().positive() }).optional(),
  /** Short labels for browsing and search, e.g. "cosy", "mystery". */
  tags: z.array(z.string()).default([]),
  estimatedMinutes: z.number().positive(),
  minEngine: z.string().default("0.1.0"),
  cover: z.string().optional(),
  cast: z.array(CastMember),
  startScene: Id,
  flags: z.record(z.string(), FlagValue).default({}),
  exports: z.array(z.string()).default([]),
  imports: z.record(z.string(), z.object({ from: Id, default: FlagValue })).default({}),
  items: z.array(Item).default([]),
  /** Entry ink file, relative to narrative/. */
  narrative: z.string().default("main.ink"),
});

export { Theme, Scene, Puzzle };
