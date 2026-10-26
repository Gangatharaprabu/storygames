import type { CSSProperties } from "react";
import { CANVAS } from "@storygames/pack-spec";

/** Canvas units → percentages of the stage, so the scene scales to any screen. */
export function rectStyle(r: { x: number; y: number; w: number; h: number }): CSSProperties {
  return {
    left: `${(r.x / CANVAS.width) * 100}%`,
    top: `${(r.y / CANVAS.height) * 100}%`,
    width: `${(r.w / CANVAS.width) * 100}%`,
    height: `${(r.h / CANVAS.height) * 100}%`,
  };
}
