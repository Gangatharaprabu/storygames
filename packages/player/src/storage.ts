import type { FlagValue } from "@storygames/pack-spec";
import type { SaveData } from "@storygames/engine";

// Device-local storage for now. Cloud sync (Milestone 7) will sit behind these same functions.

const saveKey = (packId: string) => `sg:save:${packId}`;
const SAGA_KEY = "sg:saga";

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): play continues, it just won't resume.
  }
}

export const loadSave = (packId: string) => read<SaveData>(saveKey(packId));
export const writeSave = (save: SaveData) => write(saveKey(save.packId), save);
export function clearSave(packId: string) {
  try {
    localStorage.removeItem(saveKey(packId));
  } catch {
    /* ignore */
  }
}

/** The saga profile: exported flags of finished stories, keyed by story id. */
export type Saga = Record<string, Record<string, FlagValue>>;

export const loadSaga = () => read<Saga>(SAGA_KEY) ?? {};
export function recordExports(packId: string, exports: Record<string, FlagValue>) {
  write(SAGA_KEY, { ...loadSaga(), [packId]: exports });
}

/** Resolve a story's declared imports from the saga. Missing ones fall back to the story's defaults. */
export function importsFor(imports: Record<string, { from: string }>, saga: Saga): Record<string, FlagValue> {
  const out: Record<string, FlagValue> = {};
  for (const [name, { from }] of Object.entries(imports)) {
    const v = saga[from]?.[name];
    if (v !== undefined) out[name] = v;
  }
  return out;
}
