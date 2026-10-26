import type { FlagValue } from "@storygames/pack-spec";

/** Everything that changes during play. Plain JSON, so it can be saved anywhere. */
export interface GameState {
  scene: string;
  flags: Record<string, FlagValue>;
  inventory: string[];
  solved: string[];
  hintsUsed: Record<string, number>;
  visited: string[];
  completed: boolean;
}

export interface SaveData {
  packId: string;
  packVersion: string;
  savedAt: string;
  state: GameState;
  /** ink's own state (visit counts, etc.). */
  ink: string;
}
