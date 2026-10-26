import { describe, expect, it } from "vitest";
import type { StoryPackInput } from "./schemas/pack.ts";
import { validatePack } from "./validate.ts";

const base = (): StoryPackInput => ({
  manifest: { packFormat: 1, id: "t", version: "1.0.0", title: "T", orientation: "portrait", estimatedMinutes: 1, minEngine: "0.1.0" },
  theme: { colors: { background: "#000", surface: "#111", text: "#fff", muted: "#aaa", accent: "#f80", accentText: "#000" } },
  cast: [{ character: "a", role: "protagonist" }],
  characters: [{ id: "a", name: "A", variant: "default", color: "#fff", defaultExpression: "n", portraits: { n: "a.png" } }],
  startScene: "one",
  scenes: [
    { id: "one", background: "1.png", hotspots: [{ id: "go", label: "Go", rect: { x: 0, y: 0, w: 1, h: 1 }, actions: [{ do: "goto", scene: "two" }] }] },
    { id: "two", background: "2.png", onEnter: [{ do: "end" }] },
  ],
  narrative: { ink: "{}", knots: [] },
});

describe("validatePack", () => {
  it("accepts a minimal valid pack", () => {
    const r = validatePack(base());
    expect(r.ok).toBe(true);
  });

  it("reports unknown references", () => {
    const pack = base();
    pack.scenes[0]!.hotspots![0]!.actions = [{ do: "goto", scene: "nowhere" }];
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.message)).toContain('unknown scene "nowhere"');
  });

  it("finds dead ends", () => {
    const pack = base();
    pack.scenes.push({ id: "trap", background: "3.png" });
    pack.scenes[0]!.hotspots!.push({ id: "trap", label: "Trap", rect: { x: 0, y: 0, w: 1, h: 1 }, actions: [{ do: "goto", scene: "trap" }] });
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ path: "scenes.trap", message: "dead end: no way to reach the ending from this scene" });
  });

  it("requires an ending", () => {
    const pack = base();
    pack.scenes[1]!.onEnter = [];
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
  });
});
