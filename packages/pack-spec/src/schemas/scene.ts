import { z } from "zod";
import { Action, AssetPath, Camera, Condition, Id, Rect, Transition } from "./common.ts";

export const Layer = z.object({
  id: Id,
  image: AssetPath,
  rect: Rect,
  if: Condition.optional(),
});

export const Hotspot = z.object({
  id: Id,
  /** Shown as a tooltip and read by screen readers. */
  label: z.string(),
  rect: Rect,
  if: Condition.optional(),
  actions: z.array(Action).min(1),
});

/** A point-and-click location: a background, optional layers, and clickable hotspots. */
export const Scene = z.object({
  id: Id,
  title: z.string().optional(),
  background: AssetPath,
  /** Looping music or ambience. Keeps playing across scenes that name the same file. */
  music: AssetPath.optional(),
  layers: z.array(Layer).default([]),
  hotspots: z.array(Hotspot).default([]),
  /** How the scene arrives and leaves (default: fade through black). */
  enter: Transition.default({ type: "fade-black", ms: 700 }),
  exit: Transition.default({ type: "fade-black", ms: 600 }),
  /** Camera framing when the scene starts (default: the whole scene). */
  camera: Camera.default({ x: 540, y: 960, zoom: 1 }),
  /**
   * Runs every time the player enters the scene: the scene's opening, like a short anime
   * cutscene (title, camera moves, characters, dialogue). When it finishes, it's the
   * player's turn to explore.
   */
  onEnter: z.array(Action).default([]),
});
export type Scene = z.infer<typeof Scene>;
export type Hotspot = z.infer<typeof Hotspot>;
export type Layer = z.infer<typeof Layer>;
