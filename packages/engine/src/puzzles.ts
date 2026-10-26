/**
 * The logic half of a puzzle type: no visuals, so it runs headless (tests, validation)
 * and the same rules apply whatever skin the story gives it.
 */
export interface PuzzleType<Config = unknown, Answer = unknown> {
  type: string;
  /** Validate and normalise the story's config. Throw with a helpful message if invalid. */
  parseConfig(raw: unknown): Config;
  check(config: Config, answer: Answer): boolean;
}

export type PuzzleRegistry = Record<string, PuzzleType<any, any>>;
