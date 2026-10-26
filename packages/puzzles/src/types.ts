import type { ComponentType } from "react";

/**
 * The view half of a puzzle type. It draws only with the story's theme (CSS variables
 * --sg-*) and the art the story puts in its skin slots, so it looks native to each story.
 */
export interface PuzzleViewProps<Config> {
  config: Config;
  /** Skin slot name → resolved image URL. Every slot is optional; views fall back to theme colours. */
  skin: Record<string, string>;
  /** Returns whether the answer was correct. */
  onSubmit: (answer: unknown) => boolean;
}

export type PuzzleView<Config = unknown> = ComponentType<PuzzleViewProps<Config>>;
