import { z } from "zod";
import { AssetPath, Id } from "./common.ts";

/**
 * The list of published stories the player app browses. Lives at `catalog.json` next to
 * the pack folders; every path in it is relative to that file.
 */
export const CatalogEntry = z.object({
  id: Id,
  version: z.string(),
  title: z.string(),
  synopsis: z.string(),
  series: z.object({ id: Id, title: z.string(), episode: z.number().int().positive() }).optional(),
  tags: z.array(z.string()),
  estimatedMinutes: z.number().positive(),
  minEngine: z.string(),
  /** Folder of the pack (contains pack.json). */
  pack: z.string(),
  cover: AssetPath,
  cast: z.array(
    z.object({
      id: Id,
      name: z.string(),
      role: z.enum(["protagonist", "npc"]),
      portrait: AssetPath,
    }),
  ),
  /** Flags this story reads from earlier stories (so the app can suggest playing those first). */
  continuesFrom: z.array(Id),
  publishedAt: z.string(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z.object({
  catalogFormat: z.literal(1),
  generatedAt: z.string(),
  stories: z.array(CatalogEntry),
});
export type Catalog = z.infer<typeof Catalog>;
