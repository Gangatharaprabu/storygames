import { z } from "zod";
import { Action, AssetPath, Id, Rect } from "./common.ts";

/**
 * A puzzle instance: a puzzle *type* (engine code) + this story's data.
 * `config` is validated by the puzzle type itself; `skin` fills the type's art slots.
 */
export const Puzzle = z.object({
  id: Id,
  type: Id,
  /** `fullscreen` opens a themed puzzle screen; `inline` shows it as a panel over the scene. */
  presentation: z.enum(["fullscreen", "inline"]).default("fullscreen"),
  /** For `inline`: where the panel sits on the scene. */
  rect: Rect.optional(),
  title: z.string().optional(),
  prompt: z.string().optional(),
  config: z.unknown(),
  skin: z.record(z.string(), AssetPath).default({}),
  /** Tiered hints, gentlest first. */
  hints: z.array(z.string()).default([]),
  onSolve: z.array(Action).default([]),
});
export type Puzzle = z.infer<typeof Puzzle>;
