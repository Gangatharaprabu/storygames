import { CombinationLockView } from "./combination-lock/view.tsx";
import type { PuzzleView } from "./types.ts";

export * from "./logic.ts";
export type { PuzzleView, PuzzleViewProps } from "./types.ts";

/**
 * View of every built-in puzzle type, keyed like `puzzleLogic`.
 * Each view takes its own config type; the host passes the config its puzzle type parsed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const puzzleViews: Record<string, PuzzleView<any>> = {
  "combination-lock": CombinationLockView,
};
