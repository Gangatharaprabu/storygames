import type { PuzzleRegistry } from "@storygames/engine";
import { combinationLock } from "./combination-lock/logic.ts";

/** Logic of every built-in puzzle type. Safe to import headless (no React). */
export const puzzleLogic: PuzzleRegistry = {
  [combinationLock.type]: combinationLock,
};

export { combinationLock };
export type { CombinationLockConfig } from "./combination-lock/logic.ts";
