import { z } from "zod";

/** Lowercase identifiers: `dock`, `old-ferryman`, `rope_lock`. */
export const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "ids are lowercase letters, digits, - and _");

/** Path to an asset, relative to the pack root (e.g. `assets/dock.svg`). */
export const AssetPath = z.string().min(1);

/** A rectangle in canvas units (1080 × 1920, origin top-left). */
export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const FlagValue = z.union([z.boolean(), z.number(), z.string()]);
export type FlagValue = z.infer<typeof FlagValue>;

export type Condition =
  | { flag: string; is?: z.infer<typeof FlagValue> }
  | { has: string }
  | { solved: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/**
 * When something applies. `{ flag }` alone means "flag is truthy".
 * Used by hotspots, layers and actions alike, so there is one condition language everywhere.
 */
export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ flag: z.string(), is: FlagValue.optional() }).strict(),
    z.object({ has: Id }).strict(),
    z.object({ solved: Id }).strict(),
    z.object({ all: z.array(Condition) }).strict(),
    z.object({ any: z.array(Condition) }).strict(),
    z.object({ not: Condition }).strict(),
  ]),
);

const when = { if: Condition.optional() };

/** Things that happen. Run in order; `dialogue` and `puzzle` wait for the player before continuing. */
export const Action = z.discriminatedUnion("do", [
  z.object({ do: z.literal("dialogue"), knot: z.string(), ...when }).strict(),
  z.object({ do: z.literal("puzzle"), puzzle: Id, ...when }).strict(),
  z.object({ do: z.literal("goto"), scene: Id, ...when }).strict(),
  z.object({ do: z.literal("set"), flag: z.string(), value: FlagValue.default(true), ...when }).strict(),
  z.object({ do: z.literal("give"), item: Id, ...when }).strict(),
  z.object({ do: z.literal("take"), item: Id, ...when }).strict(),
  z.object({ do: z.literal("end"), ...when }).strict(),
]);
export type Action = z.infer<typeof Action>;
