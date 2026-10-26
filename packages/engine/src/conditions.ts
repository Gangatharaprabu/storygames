import type { Condition } from "@storygames/pack-spec";
import type { GameState } from "./state.ts";

export function evaluate(cond: Condition | undefined, state: GameState): boolean {
  if (!cond) return true;
  if ("flag" in cond) {
    const value = state.flags[cond.flag];
    return cond.is === undefined ? Boolean(value) : value === cond.is;
  }
  if ("has" in cond) return state.inventory.includes(cond.has);
  if ("solved" in cond) return state.solved.includes(cond.solved);
  if ("all" in cond) return cond.all.every((c) => evaluate(c, state));
  if ("any" in cond) return cond.any.some((c) => evaluate(c, state));
  return !evaluate(cond.not, state);
}
