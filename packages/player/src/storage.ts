import type { FlagValue } from "@storygames/pack-spec";
import type { SaveData } from "@storygames/engine";
import type { ProfileData } from "./data/profile.ts";

// In-progress game saves, one per story, on this device.

const saveKey = (packId: string) => `sg:save:${packId}`;

export function loadSave(packId: string): SaveData | undefined {
  try {
    const raw = localStorage.getItem(saveKey(packId));
    return raw ? (JSON.parse(raw) as SaveData) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSave(save: SaveData) {
  try {
    localStorage.setItem(saveKey(save.packId), JSON.stringify(save));
  } catch {
    // Storage full or blocked (private mode): play continues, it just won't resume.
  }
}

export function clearSave(packId: string) {
  try {
    localStorage.removeItem(saveKey(packId));
  } catch {
    /* ignore */
  }
}

/** Resolve a story's declared imports from the saga. Missing ones fall back to the story's defaults. */
export function importsFor(imports: Record<string, { from: string }>, saga: ProfileData["saga"]): Record<string, FlagValue> {
  const out: Record<string, FlagValue> = {};
  for (const [name, { from }] of Object.entries(imports)) {
    const v = saga[from]?.[name];
    if (v !== undefined) out[name] = v;
  }
  return out;
}
