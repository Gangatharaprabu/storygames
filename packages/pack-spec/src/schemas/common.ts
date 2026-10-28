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

/** How a scene arrives or leaves. */
export const TRANSITIONS = ["none", "fade", "fade-black", "fade-white", "slide-left", "slide-right", "slide-up", "zoom", "iris", "wipe"] as const;
export const Transition = z.object({
  type: z.enum(TRANSITIONS).default("fade-black"),
  /** Duration in milliseconds. */
  ms: z.number().int().min(0).max(5000).default(700),
});
export type Transition = z.infer<typeof Transition>;

/** Where characters stand on stage. */
export const STAGE_POSITIONS = ["far-left", "left", "center", "right", "far-right"] as const;
export const StagePosition = z.enum(STAGE_POSITIONS);
export type StagePosition = z.infer<typeof StagePosition>;

/**
 * Camera framing on the scene art: the point to centre on (canvas units) and how far to zoom
 * in (1 = the whole scene). Used for anime-style pans across a background.
 */
export const Camera = z.object({
  x: z.number().min(0).max(1080).default(540),
  y: z.number().min(0).max(1920).default(960),
  zoom: z.number().min(1).max(4).default(1),
});
export type Camera = z.infer<typeof Camera>;

const ms = (dflt: number) => z.number().int().min(0).max(10000).default(dflt);
/** For movements: false lets the next action start at the same time (e.g. pan while someone walks in). */
const wait = { wait: z.boolean().default(true) };

/**
 * Things that happen. Run in order. `dialogue` and `puzzle` wait for the player; the
 * cinematic ones (camera, enter, exit, title, effect, wait) play for their duration and can
 * be tapped through.
 */
export const Action = z.discriminatedUnion("do", [
  z.object({ do: z.literal("dialogue"), knot: z.string(), ...when }).strict(),
  z.object({ do: z.literal("puzzle"), puzzle: Id, ...when }).strict(),
  z.object({ do: z.literal("goto"), scene: Id, transition: Transition.optional(), ...when }).strict(),
  z.object({ do: z.literal("set"), flag: z.string(), value: FlagValue.default(true), ...when }).strict(),
  z.object({ do: z.literal("give"), item: Id, ...when }).strict(),
  z.object({ do: z.literal("take"), item: Id, ...when }).strict(),
  z.object({ do: z.literal("end"), ...when }).strict(),

  // ---- cinematics ----
  /** Pause. */
  z.object({ do: z.literal("wait"), ms: ms(800), ...when }).strict(),
  /** Pan / zoom the camera across the scene art. */
  z.object({ do: z.literal("camera"), x: z.number().min(0).max(1080).optional(), y: z.number().min(0).max(1920).optional(), zoom: z.number().min(1).max(4).optional(), ms: ms(1200), ...wait, ...when }).strict(),
  /** Bring a character on stage (full-body sprite, or their portrait if they have none). */
  z.object({
    do: z.literal("enter"),
    character: Id,
    at: StagePosition.default("center"),
    expression: z.string().optional(),
    from: z.enum(["left", "right", "bottom", "fade"]).default("fade"),
    ms: ms(500),
    ...wait,
    ...when,
  }).strict(),
  /** Slide a character already on stage to another spot. */
  z.object({ do: z.literal("move"), character: Id, to: StagePosition, ms: ms(500), ...wait, ...when }).strict(),
  /** Change the expression of a character on stage. */
  z.object({ do: z.literal("expression"), character: Id, expression: z.string(), ...when }).strict(),
  /** Take a character off stage. */
  z.object({ do: z.literal("exit"), character: Id, to: z.enum(["left", "right", "bottom", "fade"]).default("fade"), ms: ms(400), ...wait, ...when }).strict(),
  /** A title card over the scene (chapter, place, time). */
  z.object({ do: z.literal("title"), text: z.string(), subtitle: z.string().optional(), ms: ms(2200), ...when }).strict(),
  /** A quick screen effect. */
  z.object({ do: z.literal("effect"), effect: z.enum(["shake", "flash", "flash-black"]), ms: ms(450), ...when }).strict(),
]);
export type Action = z.infer<typeof Action>;
