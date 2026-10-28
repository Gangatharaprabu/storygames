// Visual dialogue (narrative/dialogue.json) → ink → played by the engine.
import { describe, expect, it } from "vitest";
import { buildPack, dialogueToInk, inkText, memoryFolder, type DialogueFile } from "../packages/builder/src/index.ts";
import { StorySession } from "../packages/engine/src/index.ts";
import { puzzleLogic } from "../packages/puzzles/src/logic.ts";
import { diskFolder } from "../packages/cli/src/build.ts";

const dialogue: DialogueFile = {
  conversations: [
    {
      id: "meet_tomo",
      steps: [
        { type: "line", text: "The ferryman looks up. {Not} a #tag -> or // comment." },
        { type: "line", speaker: "tomo", expression: "grumpy", text: "What do you want?" },
        {
          type: "choice",
          options: [
            {
              text: "Ask [politely]",
              steps: [
                { type: "line", speaker: "mira", text: "Could you help me cross?" },
                { type: "set", flag: "asked", value: true },
                { type: "give", item: "rope" },
              ],
            },
            { text: "Leave", steps: [{ type: "goto", conversation: "bye" }] },
          ],
        },
        {
          type: "if",
          flag: "asked",
          equals: true,
          then: [{ type: "line", speaker: "tomo", expression: "happy", text: "Since you asked nicely." }],
          else: [],
        },
        { type: "line", text: "The water laps at the pier." },
      ],
    },
    { id: "bye", steps: [{ type: "line", speaker: "mira", text: "Never mind." }] },
  ],
};

async function sessionWith(d: DialogueFile) {
  // The test story, with its hand-written ink swapped for the visual dialogue.
  const disk = diskFolder("fixtures/test-story");
  const files = new Map<string, string>();
  for (const path of await disk.list("")) if (!path.startsWith("narrative/")) files.set(path, (await disk.text(path))!);
  const story = JSON.parse(files.get("story.json")!);
  story.flags = { ...story.flags, asked: false };
  files.set("story.json", JSON.stringify(story));
  // Talking to Tomo starts the conversation under test.
  const harbour = JSON.parse(files.get("scenes/harbour.json")!);
  harbour.hotspots.find((h: { id: string }) => h.id === "tomo").actions = [{ do: "dialogue", knot: "meet_tomo" }];
  files.set("scenes/harbour.json", JSON.stringify(harbour));
  // Keep the scenes' knots resolvable: one conversation per knot they use.
  const knots = ["arrival", "tomo", "tomo_rope", "lantern", "notice", "ferry_locked", "farewell", "got_rope"];
  const conversations = [...d.conversations, ...knots.map((id) => ({ id, steps: [{ type: "line" as const, text: id }] }))];
  files.set("narrative/dialogue.json", JSON.stringify({ conversations }));
  const built = await buildPack({ story: memoryFolder(files), library: diskFolder("fixtures/library") });
  expect(built.errors).toEqual([]);
  const s = new StorySession(built.pack!, { puzzles: puzzleLogic, instantCues: true });
  s.start();
  while (s.view().dialogue) s.advance();
  return s;
}

describe("visual dialogue", () => {
  it("escapes ink's special characters", () => {
    expect(inkText("a {b} #c -> d // e")).toBe("a \\{b\\} \\#c -\\> d /\\/ e");
    expect(inkText("- not a gather")).toBe("\\- not a gather");
    expect(inkText("[x]", { choice: true })).toBe("\\[x\\]");
  });

  it("plays lines, choices, flags, items and conditions", async () => {
    const s = await sessionWith(dialogue);
    s.activateHotspot("tomo");

    expect(s.view().dialogue?.text).toBe("The ferryman looks up. {Not} a #tag -> or // comment.");
    s.advance();
    expect(s.view().dialogue?.speaker?.id).toBe("tomo");
    expect(s.view().dialogue?.expression).toBe("grumpy");
    expect(s.view().dialogue?.choices).toEqual(["Ask [politely]", "Leave"]);
    s.choose(0);
    expect(s.view().dialogue?.text).toBe("Could you help me cross?");
    s.advance();
    expect(s.view().inventory.map((i) => i.id)).toEqual(["rope"]);
    expect(s.view().dialogue?.text).toBe("Since you asked nicely.");
    expect(s.view().dialogue?.expression).toBe("happy");
    s.advance();
    expect(s.view().dialogue?.text).toBe("The water laps at the pier.");
    s.advance();
    expect(s.view().dialogue).toBeNull();
    expect(s.view().state.flags.asked).toBe(true); // flags come back from ink when a conversation ends

    // Again, the other way: choices are still there (sticky), and goto ends in another conversation.
    s.activateHotspot("tomo");
    s.advance();
    s.choose(1);
    expect(s.view().dialogue?.text).toBe("Never mind.");
    s.advance();
    expect(s.view().dialogue).toBeNull();
  });

  it("reports problems by where they are", () => {
    const { problems } = dialogueToInk(
      { conversations: [{ id: "a", steps: [{ type: "give", item: "rope" }, { type: "set", flag: "nope", value: true }, { type: "goto", conversation: "zzz" }] }] },
      {},
    );
    expect(problems.map((p) => p.message)).toEqual([
      '"give:rope" needs a line of dialogue before it',
      'unknown flag "nope"',
      'no conversation "zzz"',
    ]);
  });
});
