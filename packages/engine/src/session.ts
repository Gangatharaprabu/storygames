import type { Action, Camera, CharacterSnapshot, FlagValue, Hotspot, Item, Layer, Puzzle, Scene, StoryPack, Transition } from "@storygames/pack-spec";
import { evaluate } from "./conditions.ts";
import { InkBridge, type DialogueLine } from "./dialogue.ts";
import type { PuzzleRegistry } from "./puzzles.ts";
import type { GameState, SaveData, StageEntry } from "./state.ts";
import { ENGINE_VERSION, satisfiesMinEngine } from "./version.ts";

export interface SessionOptions {
  puzzles: PuzzleRegistry;
  /** Resume from a save made by this same pack id + version. */
  save?: SaveData;
  /** Flag values carried over from earlier stories (the saga profile). */
  imports?: Record<string, FlagValue>;
  /** Finish cinematic cues immediately (headless runs, tests, tools with no screen). */
  instantCues?: boolean;
}

export interface ActivePuzzle {
  puzzle: Puzzle;
  /** Parsed by the puzzle type; hand this to the puzzle's view. */
  config: unknown;
  hintsShown: string[];
}

/**
 * Something for the screen to play before the story continues. The engine never keeps time
 * itself: the player app plays the cue (or the player taps to skip it) and calls cueDone().
 */
export type Cue =
  | { kind: "transition"; phase: "out" | "in"; transition: Transition }
  | { kind: "wait"; ms: number }
  | { kind: "camera"; ms: number }
  | { kind: "stage"; ms: number }
  | { kind: "title"; text: string; subtitle?: string; ms: number }
  | { kind: "effect"; effect: "shake" | "flash" | "flash-black"; ms: number };

export interface StageCharacter extends StageEntry {
  snapshot: CharacterSnapshot;
}

/** Everything the UI needs to draw one frame. Replaced (never mutated) on every change. */
export interface SessionView {
  state: GameState;
  scene: Scene;
  layers: Layer[];
  hotspots: Hotspot[];
  inventory: Item[];
  dialogue: DialogueLine | null;
  puzzle: ActivePuzzle | null;
  /** Cinematic step being played, if any. */
  cue: Cue | null;
  /** Characters on stage. */
  stage: StageCharacter[];
  camera: Camera;
  /** How long the latest camera move takes (ms), for the screen's transition. */
  cameraMs: number;
  /** The scene's opening is still playing; the player hasn't had their turn yet. */
  cutscene: boolean;
  /** True while dialogue, a puzzle or a cinematic step has the player's attention. */
  busy: boolean;
  completed: boolean;
}

export type SessionEvent =
  | { type: "scene-entered"; scene: string }
  | { type: "puzzle-solved"; puzzle: string }
  | { type: "completed" };

/**
 * One playthrough of one story. Headless: it knows nothing about rendering,
 * so the same session runs in the player app, in Studio preview and in tests.
 */
export class StorySession {
  readonly pack: StoryPack;
  private state: GameState;
  private ink: InkBridge;
  private puzzles: PuzzleRegistry;
  private configs = new Map<string, unknown>();
  private queue: Action[] = [];
  private dialogue: DialogueLine | null = null;
  private puzzle: ActivePuzzle | null = null;
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: SessionEvent) => void>();
  private cachedView: SessionView | null = null;
  private started = false;
  /** Last calm moment (nothing open, nothing queued), which is what gets saved. */
  private checkpoint: { state: GameState; ink: string; replayOnEnter: boolean } | null = null;
  private resumeOnEnter = false;
  private cue: Cue | null = null;
  private readonly instantCues: boolean;
  /** What happens when the current transition cue finishes. */
  private afterOut: { scene: string; enter: Transition } | "end" | null = null;
  private cutscene = false;
  private cameraMs = 0;

  constructor(pack: StoryPack, options: SessionOptions) {
    if (!satisfiesMinEngine(pack.manifest.minEngine)) {
      throw new Error(`"${pack.manifest.title}" needs engine ${pack.manifest.minEngine}; this is ${ENGINE_VERSION}`);
    }
    this.pack = pack;
    this.puzzles = options.puzzles;
    this.instantCues = options.instantCues ?? false;
    for (const p of pack.puzzles) {
      const type = this.puzzles[p.type];
      if (!type) throw new Error(`puzzle "${p.id}" uses unknown puzzle type "${p.type}"`);
      try {
        this.configs.set(p.id, type.parseConfig(p.config));
      } catch (e) {
        throw new Error(`puzzle "${p.id}": ${(e as Error).message}`);
      }
    }
    this.ink = new InkBridge(pack.narrative.ink, pack.characters);

    const save = options.save;
    if (save && this.saveFits(save)) {
      this.state = structuredClone(save.state);
      this.ink.loadState(save.ink);
      this.resumeOnEnter = Boolean(save.replayOnEnter);
    } else {
      const flags = { ...pack.flags };
      for (const [name, imp] of Object.entries(pack.imports)) {
        flags[name] = options.imports?.[name] ?? imp.default;
      }
      this.state = {
        scene: pack.startScene,
        flags,
        inventory: [],
        solved: [],
        hintsUsed: {},
        visited: [],
        completed: false,
      };
    }
  }

  /** Enter the first scene. Call once, after subscribing. */
  start() {
    if (this.started) return;
    this.started = true;
    if (this.state.visited.length === 0) this.enterScene(this.pack.startScene);
    else if (this.resumeOnEnter) {
      this.takeCheckpoint(true);
      this.resetStage(this.sceneById(this.state.scene));
      this.cutscene = true;
      this.queue.push(...this.sceneById(this.state.scene).onEnter);
    } else this.takeCheckpoint(false);
    // Every visit opens with the scene's entrance.
    this.pump(true);
    this.cue = { kind: "transition", phase: "in", transition: this.sceneById(this.state.scene).enter };
    this.changed();
  }

  // ---- reading -------------------------------------------------------------

  view(): SessionView {
    if (this.cachedView) return this.cachedView;
    const s = this.state;
    const scene = this.sceneById(s.scene);
    const items = new Map(this.pack.items.map((i) => [i.id, i]));
    this.cachedView = {
      state: s,
      scene,
      layers: scene.layers.filter((l) => evaluate(l.if, s)),
      hotspots: scene.hotspots.filter((h) => evaluate(h.if, s)),
      inventory: s.inventory.map((id) => items.get(id)!).filter(Boolean),
      dialogue: this.dialogue,
      puzzle: this.puzzle,
      cue: this.cue,
      stage: (s.stage ?? []).flatMap((e) => {
        const snapshot = this.pack.characters.find((c) => c.id === e.character);
        return snapshot ? [{ ...e, snapshot }] : [];
      }),
      camera: s.camera ?? scene.camera,
      cameraMs: this.cameraMs,
      cutscene: this.cutscene,
      busy: Boolean(this.dialogue || this.puzzle || this.cue),
      completed: s.completed,
    };
    return this.cachedView;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onEvent(listener: (e: SessionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * The game as of its last calm moment. Saving in the middle of a conversation or
   * puzzle saves from just before it, so resuming replays it instead of skipping it.
   */
  save(): SaveData {
    const cp = this.checkpoint ?? { state: this.state, ink: this.ink.saveState(), replayOnEnter: false };
    return {
      packId: this.pack.manifest.id,
      packVersion: this.pack.manifest.version,
      savedAt: new Date().toISOString(),
      state: structuredClone(cp.state),
      ink: cp.ink,
      ...(cp.replayOnEnter ? { replayOnEnter: true } : {}),
    };
  }

  /** Values of this story's exported flags, for sequels. */
  exports(): Record<string, FlagValue> {
    const out: Record<string, FlagValue> = {};
    for (const name of this.pack.exports) {
      const v = this.state.flags[name];
      if (v !== undefined) out[name] = v;
    }
    return out;
  }

  // ---- player input --------------------------------------------------------

  activateHotspot(id: string) {
    if (this.dialogue || this.puzzle || this.cue || this.state.completed) return;
    const hotspot = this.view().hotspots.find((h) => h.id === id);
    if (!hotspot) return;
    this.queue.push(...hotspot.actions);
    this.pump();
  }

  /** Advance past the current dialogue line (when it has no choices). */
  advance() {
    if (!this.dialogue || this.dialogue.choices) return;
    this.nextLine();
  }

  choose(index: number) {
    if (!this.dialogue?.choices || index < 0 || index >= this.dialogue.choices.length) return;
    this.ink.choose(index);
    this.nextLine();
  }

  /** The screen finished playing the current cue (or the player tapped to skip it). */
  cueDone() {
    const cue = this.cue;
    if (!cue) return;
    this.cue = null;
    if (cue.kind === "transition" && cue.phase === "out") {
      const next = this.afterOut;
      this.afterOut = null;
      if (next === "end") {
        this.state.completed = true;
        this.queue = [];
        this.cutscene = false;
        this.emit({ type: "completed" });
        this.changed();
        return;
      }
      if (next) {
        this.enterScene(next.scene);
        this.pump(true);
        this.cue = { kind: "transition", phase: "in", transition: next.enter };
        this.changed();
        return;
      }
    }
    // Characters who were walking off are gone now.
    if (this.state.stage?.some((e) => e.leaving)) this.state.stage = this.state.stage.filter((e) => !e.leaving);
    this.pump();
  }

  /** Returns whether the answer was correct. */
  submitPuzzle(answer: unknown): boolean {
    const active = this.puzzle;
    if (!active) return false;
    const type = this.puzzles[active.puzzle.type]!;
    if (!type.check(active.config, answer)) return false;
    this.state.solved.push(active.puzzle.id);
    this.puzzle = null;
    this.queue.unshift(...active.puzzle.onSolve);
    this.emit({ type: "puzzle-solved", puzzle: active.puzzle.id });
    this.pump();
    return true;
  }

  /** Leave the puzzle unsolved. Anything that was queued after it is dropped. */
  closePuzzle() {
    if (!this.puzzle) return;
    this.puzzle = null;
    this.queue = [];
    this.changed();
  }

  /** Reveal the next hint for the open puzzle. */
  requestHint() {
    const active = this.puzzle;
    if (!active) return;
    const id = active.puzzle.id;
    const used = this.state.hintsUsed[id] ?? 0;
    if (used >= active.puzzle.hints.length) return;
    this.state.hintsUsed[id] = used + 1;
    this.puzzle = { ...active, hintsShown: active.puzzle.hints.slice(0, used + 1) };
    this.changed();
  }

  // ---- debug (Studio preview / debug panel only) ----------------------------

  /** Tools for authors testing a story. Never shown to players. */
  readonly debug = {
    /** Jump straight to a scene, dropping any open dialogue or puzzle. */
    goto: (sceneId: string) => {
      this.sceneById(sceneId);
      this.interrupt();
      this.enterScene(sceneId);
      this.pump();
    },
    setFlag: (name: string, value: FlagValue) => {
      this.state.flags[name] = value;
      this.changed();
    },
    give: (itemId: string) => {
      if (!this.state.inventory.includes(itemId)) this.state.inventory.push(itemId);
      this.changed();
    },
    take: (itemId: string) => {
      this.state.inventory = this.state.inventory.filter((i) => i !== itemId);
      this.changed();
    },
    /** Solve the open puzzle (running its onSolve), or mark another puzzle solved. */
    solve: (puzzleId?: string) => {
      const active = this.puzzle;
      if (active && (!puzzleId || puzzleId === active.puzzle.id)) {
        this.state.solved.push(active.puzzle.id);
        this.puzzle = null;
        this.queue.unshift(...active.puzzle.onSolve);
        this.emit({ type: "puzzle-solved", puzzle: active.puzzle.id });
        this.pump();
      } else if (puzzleId && !this.state.solved.includes(puzzleId)) {
        this.state.solved.push(puzzleId);
        this.changed();
      }
    },
    /** Finish whatever cinematic step is playing. */
    skipCue: () => this.cueDone(),
    /** Close the current dialogue as if it had been read to the end. */
    skipDialogue: () => {
      if (!this.dialogue) return;
      this.dialogue = null;
      this.state.flags = this.ink.pullFlags(this.state.flags);
      this.pump();
    },
  };

  // ---- internals -----------------------------------------------------------

  /** A save is only used if it was made by this story and still makes sense for it. */
  private saveFits(save: SaveData): boolean {
    const p = this.pack;
    if (save.packId !== p.manifest.id || save.packVersion !== p.manifest.version) return false;
    const scenes = new Set(p.scenes.map((s) => s.id));
    const items = new Set(p.items.map((i) => i.id));
    const puzzles = new Set(p.puzzles.map((x) => x.id));
    const st = save.state;
    return scenes.has(st.scene) && st.inventory.every((i) => items.has(i)) && st.solved.every((x) => puzzles.has(x));
  }

  private interrupt() {
    this.dialogue = null;
    this.puzzle = null;
    this.cue = null;
    this.afterOut = null;
    this.queue = [];
  }

  /** A new scene starts with an empty stage and its own camera framing. */
  private resetStage(scene: Scene) {
    this.state.stage = [];
    this.state.camera = { ...scene.camera };
    this.cameraMs = 0;
  }

  private updateStage(character: string, fn: (e: StageEntry) => StageEntry) {
    this.state.stage = (this.state.stage ?? []).map((e) => (e.character === character ? fn(e) : e));
  }

  /** Run queued actions until one needs the player (dialogue/puzzle) or the queue is empty. */
  /**
   * Runs queued actions until one has to wait for the player or the screen.
   * `setupOnly` stops at the first action that would show anything over time: it's used just
   * before a scene fades in, so the opening framing and cast are already in place.
   */
  private pump(setupOnly = false) {
    while (this.queue.length && !this.dialogue && !this.puzzle && !this.cue && !this.state.completed) {
      if (setupOnly && !isSetup(this.queue[0]!)) break;
      const a = this.queue.shift()!;
      if (!evaluate(a.if, this.state)) continue;
      switch (a.do) {
        case "dialogue":
          this.ink.start(a.knot, this.state.flags);
          this.nextLine(false);
          break;
        case "puzzle": {
          if (this.state.solved.includes(a.puzzle)) break;
          const puzzle = this.pack.puzzles.find((p) => p.id === a.puzzle)!;
          const used = this.state.hintsUsed[puzzle.id] ?? 0;
          this.puzzle = { puzzle, config: this.configs.get(puzzle.id), hintsShown: puzzle.hints.slice(0, used) };
          break;
        }
        case "goto": {
          const target = this.sceneById(a.scene);
          const current = this.sceneById(this.state.scene);
          this.afterOut = { scene: a.scene, enter: a.transition ?? target.enter };
          this.cue = { kind: "transition", phase: "out", transition: a.transition ?? current.exit };
          break;
        }
        case "set":
          this.state.flags[a.flag] = a.value;
          break;
        case "give":
          if (!this.state.inventory.includes(a.item)) this.state.inventory.push(a.item);
          break;
        case "take":
          this.state.inventory = this.state.inventory.filter((i) => i !== a.item);
          break;
        case "end":
          // The scene leaves first, then the ending appears.
          this.queue = [];
          this.afterOut = "end";
          this.cue = { kind: "transition", phase: "out", transition: this.sceneById(this.state.scene).exit };
          break;
        case "wait":
          this.cue = { kind: "wait", ms: a.ms };
          break;
        case "camera": {
          const cam = this.state.camera ?? this.sceneById(this.state.scene).camera;
          this.state.camera = { x: a.x ?? cam.x, y: a.y ?? cam.y, zoom: a.zoom ?? cam.zoom };
          this.cameraMs = a.ms;
          if (a.wait && a.ms > 0) this.cue = { kind: "camera", ms: a.ms };
          break;
        }
        case "enter": {
          const c = this.pack.characters.find((x) => x.id === a.character)!;
          const stage = (this.state.stage ?? []).filter((e) => e.character !== a.character);
          stage.push({ character: a.character, at: a.at, expression: a.expression ?? c.defaultExpression, from: a.from });
          this.state.stage = stage;
          if (a.wait && a.ms > 0) this.cue = { kind: "stage", ms: a.ms };
          break;
        }
        case "move":
          this.updateStage(a.character, (e) => ({ ...e, at: a.to }));
          if (a.wait && a.ms > 0) this.cue = { kind: "stage", ms: a.ms };
          break;
        case "expression":
          this.updateStage(a.character, (e) => ({ ...e, expression: a.expression }));
          break;
        case "exit":
          this.updateStage(a.character, (e) => ({ ...e, leaving: { to: a.to } }));
          if (a.wait && a.ms > 0) this.cue = { kind: "stage", ms: a.ms };
          break;
        case "title":
          this.cue = { kind: "title", text: a.text, subtitle: a.subtitle, ms: a.ms };
          break;
        case "effect":
          this.cue = { kind: "effect", effect: a.effect, ms: a.ms };
          break;
      }
    }
    if (!this.dialogue && !this.puzzle && !this.cue && !this.queue.length) {
      this.cutscene = false; // the scene's opening is over: the player's turn
      this.takeCheckpoint(false);
    }
    this.changed();
  }

  private takeCheckpoint(replayOnEnter: boolean) {
    this.checkpoint = { state: structuredClone(this.state), ink: this.ink.saveState(), replayOnEnter };
  }

  private nextLine(pumpWhenDone = true) {
    const next = this.ink.next();
    if (!next) {
      this.dialogue = null;
      this.state.flags = this.ink.pullFlags(this.state.flags);
      if (pumpWhenDone) this.pump();
      return;
    }
    for (const e of next.effects) {
      if ("give" in e && !this.state.inventory.includes(e.give)) this.state.inventory.push(e.give);
      if ("take" in e) this.state.inventory = this.state.inventory.filter((i) => i !== e.take);
    }
    this.dialogue = next.line;
    this.changed();
  }

  private enterScene(id: string) {
    this.state.scene = id;
    if (!this.state.visited.includes(id)) this.state.visited.push(id);
    this.resetStage(this.sceneById(id));
    this.cutscene = true;
    this.takeCheckpoint(true);
    // A scene's onEnter runs before anything else still queued.
    this.queue.unshift(...this.sceneById(id).onEnter);
    this.emit({ type: "scene-entered", scene: id });
  }

  private sceneById(id: string): Scene {
    const scene = this.pack.scenes.find((s) => s.id === id);
    if (!scene) throw new Error(`unknown scene "${id}"`);
    return scene;
  }

  private changed() {
    if (this.instantCues && this.cue) return this.cueDone();
    this.cachedView = null;
    this.listeners.forEach((l) => l());
  }

  private emit(e: SessionEvent) {
    this.eventListeners.forEach((l) => l(e));
  }
}

/** Actions that change the picture instantly, so they can run before a scene is shown. */
function isSetup(a: Action): boolean {
  switch (a.do) {
    case "set":
    case "give":
    case "take":
    case "expression":
      return true;
    case "camera":
    case "enter":
    case "move":
    case "exit":
      return !a.wait || a.ms === 0;
    default:
      return false;
  }
}
