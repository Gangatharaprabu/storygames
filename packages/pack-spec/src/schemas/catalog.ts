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
  /** Stories this one carries on from (its `follows`, plus any it imports choices from). */
  continuesFrom: z.array(Id),
  publishedAt: z.string(),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const CatalogSeries = z.object({
  id: Id,
  title: z.string(),
  synopsis: z.string(),
  /** Episodes in order. */
  stories: z.array(Id),
  /** Stories outside this series that it carries on from: where it branched off. */
  branchesFrom: z.array(Id),
});
export type CatalogSeries = z.infer<typeof CatalogSeries>;

/** A character across every published story they appear in. */
export const CatalogCharacter = z.object({
  id: Id,
  name: z.string(),
  bio: z.string(),
  color: z.string(),
  portrait: AssetPath,
  /** Stories they appear in, in catalog order. */
  stories: z.array(Id),
});
export type CatalogCharacter = z.infer<typeof CatalogCharacter>;

export const Catalog = z.object({
  catalogFormat: z.literal(1),
  generatedAt: z.string(),
  stories: z.array(CatalogEntry),
  series: z.array(CatalogSeries).default([]),
  characters: z.array(CatalogCharacter).default([]),
});
export type Catalog = z.infer<typeof Catalog>;
