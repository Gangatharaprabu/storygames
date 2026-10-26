import { z } from "zod";
import { AssetPath, Id } from "./common.ts";

/**
 * A character as it appears inside a published pack: a frozen snapshot of the library
 * character (one variant), so later library edits never change a published story.
 */
export const CharacterSnapshot = z.object({
  id: Id,
  name: z.string(),
  variant: z.string(),
  /** Accent colour for this character's name/dialogue. */
  color: z.string(),
  defaultExpression: z.string(),
  /** expression name → portrait image */
  portraits: z.record(z.string(), AssetPath),
});
export type CharacterSnapshot = z.infer<typeof CharacterSnapshot>;

export const CastMember = z.object({
  character: Id,
  variant: z.string().default("default"),
  role: z.enum(["protagonist", "npc"]),
});
