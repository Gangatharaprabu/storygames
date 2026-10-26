// Integration: builds the fixture story with the real CLI and plays every route headless.
import { describe, expect, it } from "vitest";
import { buildStory } from "../packages/cli/src/build.ts";
import { StorySession } from "../packages/engine/src/index.ts";
import { puzzleLogic } from "../packages/puzzles/src/logic.ts";

function newSession() {
  const result = buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
  expect(result.errors).toEqual([]);
  const session = new StorySession(result.pack!, { puzzles: puzzleLogic });
  session.start();
  return session;
}

/** Click through dialogue, picking `choice` whenever choices appear. */
function finishDialogue(s: StorySession, choice = 0) {
  for (let i = 0; i < 50 && s.view().dialogue; i++) {
    if (s.view().dialogue!.choices) s.choose(choice);
    else s.advance();
  }
  expect(s.view().dialogue).toBeNull();
}

describe("The Last Ferry", () => {
  it("opens with the arrival narration", () => {
    const s = newSession();
    expect(s.view().scene.id).toBe("harbour");
    expect(s.view().dialogue?.speaker).toBeUndefined();
    s.advance();
    expect(s.view().dialogue?.speaker?.id).toBe("mira");
    expect(s.view().dialogue?.expression).toBe("worried");
  });

  it("route A: help Tomo, open the tackle box, read the lantern, cross", () => {
    const s = newSession();
    finishDialogue(s);
    s.activateHotspot("tomo");
    finishDialogue(s, 0); // offer to help
    expect(s.view().state.flags.helped_ferryman).toBe(true);
    expect(s.view().hotspots.map((h) => h.id)).toContain("tackle-box");
    expect(s.view().hotspots.map((h) => h.id)).not.toContain("noticeboard");

    s.activateHotspot("tackle-box");
    expect(s.view().puzzle?.puzzle.presentation).toBe("inline");
    expect(s.submitPuzzle(["1", "2"])).toBe(false);
    expect(s.submitPuzzle(["7", "2"])).toBe(true);
    finishDialogue(s);
    expect(s.view().inventory.map((i) => i.id)).toEqual(["rope"]);

    s.activateHotspot("tomo");
    finishDialogue(s);
    expect(s.view().inventory).toEqual([]);
    expect(s.view().state.flags.knows_code).toBe(true);

    s.activateHotspot("ferry");
    expect(s.view().puzzle?.puzzle.id).toBe("ferry-lock");
    expect(s.submitPuzzle(["3", "1", "4"])).toBe(true);
    expect(s.view().scene.id).toBe("at-sea");
    expect(s.view().dialogue?.text).toMatch(/chain falls away/);
    s.advance();
    expect(s.view().dialogue?.speaker?.id).toBe("tomo"); // he waves goodbye on this route
    finishDialogue(s);
    expect(s.view().completed).toBe(true);
    expect(s.exports()).toEqual({ helped_ferryman: true });
  });

  it("route B: refuse Tomo, read the noticeboard, cross alone", () => {
    const s = newSession();
    finishDialogue(s);
    s.activateHotspot("tomo");
    finishDialogue(s, 1); // insist
    const ids = s.view().hotspots.map((h) => h.id);
    expect(ids).toContain("noticeboard");
    expect(ids).not.toContain("tackle-box");

    s.activateHotspot("ferry");
    s.requestHint();
    expect(s.view().puzzle?.hintsShown).toHaveLength(1);
    expect(s.submitPuzzle(["3", "1", "4"])).toBe(true);
    s.advance();
    expect(s.view().dialogue?.speaker).toBeUndefined(); // Tomo stays silent
    finishDialogue(s);
    expect(s.view().completed).toBe(true);
    expect(s.exports()).toEqual({ helped_ferryman: false });
  });

  it("the ferry is just locked before talking to Tomo, and leaving a puzzle cancels what follows", () => {
    const s = newSession();
    finishDialogue(s);
    s.activateHotspot("ferry");
    expect(s.view().puzzle).toBeNull();
    finishDialogue(s);

    s.activateHotspot("tomo");
    finishDialogue(s, 1);
    s.activateHotspot("ferry");
    s.closePuzzle();
    expect(s.view().puzzle).toBeNull();
    expect(s.view().scene.id).toBe("harbour");
  });

  it("resumes from a save mid-story", () => {
    const s = newSession();
    finishDialogue(s);
    s.activateHotspot("tomo");
    finishDialogue(s, 0);
    const save = JSON.parse(JSON.stringify(s.save()));

    const result = buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
    const resumed = new StorySession(result.pack!, { puzzles: puzzleLogic, save });
    resumed.start();
    expect(resumed.view().state.flags.helped_ferryman).toBe(true);
    expect(resumed.view().dialogue).toBeNull();
    resumed.activateHotspot("tomo");
    expect(resumed.view().dialogue?.text).toMatch(/Still here/); // ink remembers too
  });
});
