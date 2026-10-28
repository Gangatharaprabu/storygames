import type { Camera, FlagValue, StagePosition } from "@storygames/pack-spec";

/** A character standing on stage. */
export interface StageEntry {
  character: string;
  at: StagePosition;
  expression: string;
  /** How they arrived (drives the entrance animation). */
  from: "left" | "right" | "bottom" | "fade";
  /** Set while they're walking off; removed when that finishes. */
  leaving?: { to: "left" | "right" | "bottom" | "fade" };
}

/** Everything that changes during play. Plain JSON, so it can be saved anywhere. */
export interface GameState {
  scene: string;
  flags: Record<string, FlagValue>;
  inventory: string[];
  solved: string[];
  hintsUsed: Record<string, number>;
  visited: string[];
  completed: boolean;
  /** Characters on stage and the camera framing (older saves don't have them). */
  stage?: StageEntry[];
  camera?: Camera;
}

export interface SaveData {
  packId: string;
  packVersion: string;
  savedAt: string;
  state: GameState;
  /** ink's own state (visit counts, etc.). */
  ink: string;
  /** The scene's onEnter had not finished when this was saved; run it again on resume. */
  replayOnEnter?: boolean;
}
