import { z } from "zod";
import { AssetPath } from "./common.ts";

/**
 * The story's look. The player UI and every puzzle view draw with these tokens,
 * so dialogue, inventory and puzzle screens all feel native to the story.
 */
export const Theme = z.object({
  colors: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
    accent: z.string(),
    accentText: z.string(),
  }),
  fonts: z
    .object({
      body: z.string().default("system-ui, sans-serif"),
      display: z.string().default("system-ui, sans-serif"),
    })
    .default({ body: "system-ui, sans-serif", display: "system-ui, sans-serif" }),
  radius: z.number().default(16),
  /** CSS filter applied over every scene to unify art from different sources. */
  colorGrade: z.string().optional(),
  /** Optional frame art drawn behind the dialogue box. */
  dialogueFrame: AssetPath.optional(),
});
export type Theme = z.infer<typeof Theme>;
