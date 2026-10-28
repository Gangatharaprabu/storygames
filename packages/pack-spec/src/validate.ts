import type { Action, Condition } from "./schemas/common.ts";
import { StoryPack } from "./schemas/pack.ts";
import { PACK_FORMAT } from "./version.ts";

export interface Problem {
  /** Where in the pack, e.g. `scenes.dock.hotspots.lantern`. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; pack: StoryPack; warnings: Problem[] }
  | { ok: false; errors: Problem[]; warnings: Problem[] };

/**
 * Validates a story pack: shape (schemas), references (every scene, puzzle, item,
 * knot and character mentioned exists) and structure (the ending is reachable and
 * no reachable scene is a dead end).
 */
export function validatePack(input: unknown): ValidationResult {
  const parsed = StoryPack.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      warnings: [],
      errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const pack = parsed.data;
  const errors: Problem[] = [];
  const warnings: Problem[] = [];

  if (pack.manifest.packFormat !== PACK_FORMAT) {
    errors.push({ path: "manifest.packFormat", message: `expected ${PACK_FORMAT}, got ${pack.manifest.packFormat}` });
  }

  const sceneIds = unique(pack.scenes.map((s) => s.id), "scenes", errors);
  const puzzleIds = unique(pack.puzzles.map((p) => p.id), "puzzles", errors);
  const itemIds = unique(pack.items.map((i) => i.id), "items", errors);
  const characterIds = unique(pack.characters.map((c) => c.id), "characters", errors);
  const knots = new Set(pack.narrative.knots);
  const characters = new Map(pack.characters.map((c) => [c.id, c]));

  if (!sceneIds.has(pack.startScene)) {
    errors.push({ path: "startScene", message: `unknown scene "${pack.startScene}"` });
  }
  for (const member of pack.cast) {
    if (!characterIds.has(member.character)) {
      errors.push({ path: "cast", message: `cast member "${member.character}" has no character snapshot` });
    }
  }
  if (pack.cast.filter((m) => m.role === "protagonist").length !== 1) {
    errors.push({ path: "cast", message: "a story needs exactly one protagonist" });
  }
  for (const c of pack.characters) {
    if (!c.portraits[c.defaultExpression]) {
      errors.push({ path: `characters.${c.id}`, message: `no portrait for default expression "${c.defaultExpression}"` });
    }
  }
  if (pack.manifest.follows.includes(pack.manifest.id)) {
    errors.push({ path: "manifest.follows", message: "a story can't follow itself" });
  }
  for (const name of pack.exports) {
    if (!(name in pack.flags)) {
      errors.push({ path: "exports", message: `exported flag "${name}" is not declared in flags` });
    }
  }

  const checkCondition = (cond: Condition | undefined, path: string) => {
    if (!cond) return;
    if ("has" in cond && !itemIds.has(cond.has)) errors.push({ path, message: `unknown item "${cond.has}"` });
    if ("solved" in cond && !puzzleIds.has(cond.solved)) errors.push({ path, message: `unknown puzzle "${cond.solved}"` });
    if ("flag" in cond && !(cond.flag in pack.flags) && !(cond.flag in pack.imports)) {
      warnings.push({ path, message: `flag "${cond.flag}" has no initial value in flags` });
    }
    if ("all" in cond) cond.all.forEach((c, i) => checkCondition(c, `${path}.all.${i}`));
    if ("any" in cond) cond.any.forEach((c, i) => checkCondition(c, `${path}.any.${i}`));
    if ("not" in cond) checkCondition(cond.not, `${path}.not`);
  };

  const checkActions = (actions: Action[], path: string) => {
    actions.forEach((a, i) => {
      const at = `${path}.${i}`;
      checkCondition(a.if, `${at}.if`);
      switch (a.do) {
        case "dialogue":
          if (!knots.has(a.knot)) errors.push({ path: at, message: `unknown ink knot "${a.knot}"` });
          break;
        case "puzzle":
          if (!puzzleIds.has(a.puzzle)) errors.push({ path: at, message: `unknown puzzle "${a.puzzle}"` });
          break;
        case "goto":
          if (!sceneIds.has(a.scene)) errors.push({ path: at, message: `unknown scene "${a.scene}"` });
          break;
        case "give":
        case "take":
          if (!itemIds.has(a.item)) errors.push({ path: at, message: `unknown item "${a.item}"` });
          break;
        case "enter":
        case "move":
        case "exit":
        case "expression": {
          const c = characters.get(a.character);
          if (!c) {
            errors.push({ path: at, message: `"${a.character}" isn't in this story's cast` });
            break;
          }
          const expr = a.do === "enter" ? a.expression : a.do === "expression" ? a.expression : undefined;
          if (expr && !c.portraits[expr] && !c.sprites[expr]) {
            errors.push({ path: at, message: `${c.name} has no "${expr}" expression (has: ${Object.keys({ ...c.portraits, ...c.sprites }).join(", ")})` });
          }
          break;
        }
      }
    });
  };

  for (const scene of pack.scenes) {
    const base = `scenes.${scene.id}`;
    checkActions(scene.onEnter, `${base}.onEnter`);
    scene.layers.forEach((l) => checkCondition(l.if, `${base}.layers.${l.id}.if`));
    unique(scene.hotspots.map((h) => h.id), `${base}.hotspots`, errors);
    for (const h of scene.hotspots) {
      checkCondition(h.if, `${base}.hotspots.${h.id}.if`);
      checkActions(h.actions, `${base}.hotspots.${h.id}.actions`);
    }
  }
  for (const p of pack.puzzles) {
    checkActions(p.onSolve, `puzzles.${p.id}.onSolve`);
    if (p.presentation === "inline" && !p.rect) {
      errors.push({ path: `puzzles.${p.id}`, message: "inline puzzles need a rect" });
    }
  }

  if (errors.length === 0) checkStructure(pack, errors, warnings);

  return errors.length ? { ok: false, errors, warnings } : { ok: true, pack, warnings };
}

/**
 * Builds a scene graph (edges come from `goto` actions in a scene's hotspots, onEnter,
 * and the onSolve of puzzles started there) and checks that the ending is reachable
 * from the start and that every reachable scene can still reach an ending.
 * Conditions are ignored, so this is a structural check, not a full playthrough.
 */
function checkStructure(pack: StoryPack, errors: Problem[], warnings: Problem[]) {
  const puzzles = new Map(pack.puzzles.map((p) => [p.id, p]));
  const edges = new Map<string, Set<string>>();
  const endings = new Set<string>();

  for (const scene of pack.scenes) {
    const out = new Set<string>();
    const seenPuzzles = new Set<string>();
    const walk = (actions: Action[]) => {
      for (const a of actions) {
        if (a.do === "goto") out.add(a.scene);
        if (a.do === "end") endings.add(scene.id);
        if (a.do === "puzzle" && !seenPuzzles.has(a.puzzle)) {
          seenPuzzles.add(a.puzzle);
          walk(puzzles.get(a.puzzle)?.onSolve ?? []);
        }
      }
    };
    walk(scene.onEnter);
    scene.hotspots.forEach((h) => walk(h.actions));
    edges.set(scene.id, out);
  }

  if (endings.size === 0) {
    errors.push({ path: "scenes", message: "no scene can reach an `end` action" });
    return;
  }

  const reachable = new Set<string>();
  const stack = [pack.startScene];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    edges.get(id)?.forEach((next) => stack.push(next));
  }

  if (![...endings].some((e) => reachable.has(e))) {
    errors.push({ path: "scenes", message: "the ending cannot be reached from startScene" });
  }
  for (const id of reachable) {
    if (!canReach(id, endings, edges)) {
      errors.push({ path: `scenes.${id}`, message: "dead end: no way to reach the ending from this scene" });
    }
  }
  for (const scene of pack.scenes) {
    if (!reachable.has(scene.id)) {
      warnings.push({ path: `scenes.${scene.id}`, message: "scene is never reached" });
    }
  }
}

function canReach(from: string, targets: Set<string>, edges: Map<string, Set<string>>): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (targets.has(id)) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.get(id)?.forEach((n) => stack.push(n));
  }
  return false;
}

function unique(ids: string[], path: string, errors: Problem[]): Set<string> {
  const set = new Set<string>();
  for (const id of ids) {
    if (set.has(id)) errors.push({ path, message: `duplicate id "${id}"` });
    set.add(id);
  }
  return set;
}
