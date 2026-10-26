import { z } from "zod";
import { Action, AssetPath, Condition, Id, Rect } from "./common.ts";

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
  layers: z.array(Layer).default([]),
  hotspots: z.array(Hotspot).default([]),
  /** Runs every time the player enters the scene. */
  onEnter: z.array(Action).default([]),
});
export type Scene = z.infer<typeof Scene>;
export type Hotspot = z.infer<typeof Hotspot>;
export type Layer = z.infer<typeof Layer>;
