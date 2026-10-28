import { createContext, useContext } from "react";
import type { DialogueFile } from "@storygames/builder";
import type { CharacterJson, PuzzleJson, SceneJson, StoryJson } from "../../drafts.ts";

/** Everything the story's editors refer to: ids to pick from in menus, and the story itself. */
export interface StoryRefs {
  id: string;
  root: string;
  story: StoryJson;
  setStory: (s: StoryJson) => void;
  scenes: SceneJson[];
  puzzles: PuzzleJson[];
  dialogue: DialogueFile;
  /** Hand-written ink, if the story has any (imported stories). */
  inkKnots: string[];
  /** Library characters in the cast (the chosen variant's expressions). */
  cast: Array<{ character: CharacterJson; variant: string; expressions: string[] }>;
  /** Every library character, for adding to the cast. */
  library: CharacterJson[];
  /** Files changed outside the open editors (added/removed scenes…): re-read them. */
  reload: () => void;
}

export const StoryContext = createContext<StoryRefs | null>(null);
export const useStory = () => useContext(StoryContext)!;

/** All conversation ids a dialogue action can start. */
export const knotsOf = (r: StoryRefs) => [...r.dialogue.conversations.map((c) => c.id), ...r.inkKnots];
