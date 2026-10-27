// Integration: builds the fixture story with the real CLI and plays every route headless.
import { describe, expect, it } from "vitest";
import { buildStory } from "../packages/cli/src/build.ts";
import { StorySession } from "../packages/engine/src/index.ts";
import { puzzleLogic } from "../packages/puzzles/src/logic.ts";

async function newSession() {
  const result = await buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
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
  it("opens with the arrival narration", async () => {
    const s = await newSession();
    expect(s.view().scene.id).toBe("harbour");
    expect(s.view().dialogue?.speaker).toBeUndefined();
    s.advance();
    expect(s.view().dialogue?.speaker?.id).toBe("mira");
    expect(s.view().dialogue?.expression).toBe("worried");
  });

  it("route A: help Tomo, open the tackle box, read the lantern, cross", async () => {
    const s = await newSession();
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

  it("route B: refuse Tomo, read the noticeboard, cross alone", async () => {
    const s = await newSession();
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

  it("the ferry is just locked before talking to Tomo, and leaving a puzzle cancels what follows", async () => {
    const s = await newSession();
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

  it("resumes from a save mid-story", async () => {
    const s = await newSession();
    finishDialogue(s);
    s.activateHotspot("tomo");
    finishDialogue(s, 0);
    const save = JSON.parse(JSON.stringify(s.save()));

    const result = await buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
    const resumed = new StorySession(result.pack!, { puzzles: puzzleLogic, save });
    resumed.start();
    expect(resumed.view().state.flags.helped_ferryman).toBe(true);
    expect(resumed.view().dialogue).toBeNull();
    resumed.activateHotspot("tomo");
    expect(resumed.view().dialogue?.text).toMatch(/Still here/); // ink remembers too
  });
});

describe("debug tools", () => {
  it("jump to a scene, set flags, give items, solve puzzles", async () => {
    const s = await newSession();
    expect(s.view().dialogue).not.toBeNull();
    s.debug.skipDialogue();
    expect(s.view().dialogue).toBeNull();

    s.debug.setFlag("talked_to_tomo", true);
    s.debug.give("rope");
    expect(s.view().inventory.map((i) => i.id)).toEqual(["rope"]);
    s.debug.take("rope");
    expect(s.view().inventory).toEqual([]);

    s.activateHotspot("ferry");
    expect(s.view().puzzle?.puzzle.id).toBe("ferry-lock");
    s.debug.solve();
    expect(s.view().scene.id).toBe("at-sea");

    s.debug.goto("harbour");
    expect(s.view().scene.id).toBe("harbour");
    expect(s.view().dialogue).toBeNull(); // arrival only plays once
  });

  it("ignores a save that no longer fits the story", async () => {
    const s = await newSession();
    const save = s.save();
    save.state.scene = "deleted-scene";
    const result = await buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
    const fresh = new StorySession(result.pack!, { puzzles: puzzleLogic, save });
    fresh.start();
    expect(fresh.view().scene.id).toBe("harbour");
  });
});

describe("saving mid-conversation", () => {
  it("resumes from just before the conversation, and replays it", async () => {
    const s = await newSession();
    s.advance(); // halfway through the arrival narration
    const save = JSON.parse(JSON.stringify(s.save()));
    expect(save.replayOnEnter).toBe(true);

    const result = await buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
    const resumed = new StorySession(result.pack!, { puzzles: puzzleLogic, save });
    resumed.start();
    expect(resumed.view().dialogue?.text).toMatch(/The last light/);
    finishDialogue(resumed);
    expect(resumed.view().state.flags.arrived).toBe(true);
  });

  it("an interrupted talk with Tomo is replayed, not lost", async () => {
    const s = await newSession();
    finishDialogue(s);
    s.activateHotspot("tomo");
    s.advance();
    const save = JSON.parse(JSON.stringify(s.save()));
    expect(save.state.flags.talked_to_tomo).toBe(false);

    const result = await buildStory({ storyDir: "fixtures/test-story", libraryDir: "fixtures/library" });
    const resumed = new StorySession(result.pack!, { puzzles: puzzleLogic, save });
    resumed.start();
    expect(resumed.view().dialogue).toBeNull();
    resumed.activateHotspot("tomo");
    expect(resumed.view().dialogue?.text).toMatch(/Evening/); // the first meeting again, not "Still here?"
  });
});
