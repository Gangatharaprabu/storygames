import type { FlagValue } from "@storygames/pack-spec";

/**
 * Everything the app remembers about a player except in-progress game saves:
 * their profile, saved stories, progress and the saga (choices carried into sequels).
 *
 * It is kept behind a small `ProfileBackend`, so today it lives on the device and later
 * a cloud backend (accounts, sync across devices) can replace it without touching the UI.
 */
export interface ProfileData {
  version: 1;
  profile: { id: string; name: string; avatar: string; createdAt: string; updatedAt?: string };
  /** storyId → when it was saved */
  saved: Record<string, string>;
  /** storyId → when it was un-saved (so syncing doesn't bring it back) */
  unsaved?: Record<string, string>;
  /** When "Reset all progress" was last used; older data from other devices is dropped. */
  resetAt?: string;
  progress: Record<string, StoryProgress>;
  /** storyId → that story's exported flags, from the last time it was finished */
  saga: Record<string, Record<string, FlagValue>>;
}

export interface StoryProgress {
  status: "playing" | "finished";
  startedAt: string;
  lastPlayedAt: string;
  finishedAt?: string;
  timesFinished: number;
  /** 0–100, rough: share of scenes visited and puzzles solved. */
  percent: number;
  secondsPlayed: number;
}

export interface ProfileBackend {
  load(): ProfileData | undefined;
  save(data: ProfileData): void;
}

export const AVATARS = ["🌙", "⭐", "🌊", "🌸", "🦊", "🐈", "📚", "🗝️", "🏮", "🍵"];

export function newProfile(now = new Date()): ProfileData {
  return {
    version: 1,
    profile: {
      id: globalThis.crypto?.randomUUID?.() ?? `p-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
      name: "Traveller",
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]!,
      createdAt: now.toISOString(),
    },
    saved: {},
    progress: {},
    saga: {},
  };
}

export class ProfileStore {
  private data: ProfileData;
  private listeners = new Set<() => void>();

  constructor(private backend: ProfileBackend) {
    this.data = backend.load() ?? newProfile();
  }

  get = () => this.data;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  rename(name: string, now = new Date()) {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed && trimmed !== this.data.profile.name) {
      this.update((d) => ({ ...d, profile: { ...d.profile, name: trimmed, updatedAt: now.toISOString() } }));
    }
  }

  setAvatar(avatar: string, now = new Date()) {
    this.update((d) => ({ ...d, profile: { ...d.profile, avatar, updatedAt: now.toISOString() } }));
  }

  /** Replace everything (after merging with another device). */
  replace(data: ProfileData) {
    this.update(() => data);
  }

  isSaved = (storyId: string) => storyId in this.data.saved;

  toggleSaved(storyId: string, now = new Date()) {
    this.update((d) => {
      const saved = { ...d.saved };
      const unsaved = { ...d.unsaved };
      if (storyId in saved) {
        delete saved[storyId];
        unsaved[storyId] = now.toISOString();
      } else {
        saved[storyId] = now.toISOString();
        delete unsaved[storyId];
      }
      return { ...d, saved, unsaved };
    });
  }

  /** Called while playing: keeps "continue" and the progress bar up to date. */
  recordProgress(storyId: string, percent: number, secondsPlayed = 0, now = new Date()) {
    this.update((d) => {
      const old = d.progress[storyId];
      const p: StoryProgress =
        old && old.status === "playing"
          ? { ...old }
          : {
              status: "playing",
              startedAt: now.toISOString(),
              lastPlayedAt: now.toISOString(),
              timesFinished: old?.timesFinished ?? 0,
              finishedAt: old?.finishedAt,
              percent: 0,
              secondsPlayed: old?.secondsPlayed ?? 0,
            };
      p.lastPlayedAt = now.toISOString();
      p.percent = Math.max(0, Math.min(99, Math.round(percent)));
      p.secondsPlayed += Math.max(0, Math.round(secondsPlayed));
      return { ...d, progress: { ...d.progress, [storyId]: p } };
    });
  }

  addPlaytime(storyId: string, seconds: number) {
    const p = this.data.progress[storyId];
    if (!p || seconds <= 0) return;
    this.update((d) => ({ ...d, progress: { ...d.progress, [storyId]: { ...p, secondsPlayed: p.secondsPlayed + Math.round(seconds) } } }));
  }

  finish(storyId: string, exports: Record<string, FlagValue>, now = new Date()) {
    this.update((d) => {
      const old = d.progress[storyId];
      const p: StoryProgress = {
        status: "finished",
        startedAt: old?.startedAt ?? now.toISOString(),
        lastPlayedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        timesFinished: (old?.timesFinished ?? 0) + 1,
        percent: 100,
        secondsPlayed: old?.secondsPlayed ?? 0,
      };
      return { ...d, progress: { ...d.progress, [storyId]: p }, saga: { ...d.saga, [storyId]: exports } };
    });
  }

  /** Forget a story's in-progress run (a finished story stays finished). */
  abandon(storyId: string) {
    const p = this.data.progress[storyId];
    if (!p || p.status !== "playing") return;
    this.update((d) => {
      const progress = { ...d.progress };
      if (p.timesFinished > 0) progress[storyId] = { ...p, status: "finished", percent: 100 };
      else delete progress[storyId];
      return { ...d, progress };
    });
  }

  resetAll(now = new Date()) {
    const keep = this.data.profile;
    this.update(() => ({ ...newProfile(), profile: keep, resetAt: now.toISOString() }));
  }

  private update(fn: (d: ProfileData) => ProfileData) {
    this.data = fn(this.data);
    this.backend.save(this.data);
    this.listeners.forEach((l) => l());
  }
}

/** Device storage. Survives reloads; cleared if the player clears site data. */
export function localBackend(key = "sg:profile"): ProfileBackend {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        const data = raw ? (JSON.parse(raw) as ProfileData) : undefined;
        return data?.version === 1 ? data : undefined;
      } catch {
        return undefined;
      }
    },
    save(data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* storage full or blocked: keep working in memory */
      }
    },
  };
}

/** Rough completion for the progress bar: scenes visited and puzzles solved so far. */
export function percentDone(state: { visited: string[]; solved: string[] }, totals: { scenes: number; puzzles: number }) {
  const total = totals.scenes + totals.puzzles;
  return total ? ((state.visited.length + state.solved.length) / total) * 100 : 0;
}

const later = (a?: string, b?: string) => ((a ?? "") >= (b ?? "") ? a : b);

/**
 * Combine the same player's data from two devices (or device and cloud). Nothing a player
 * did on either side is lost, and the most recent decision wins:
 * - name/avatar: the most recently changed (a never-changed default never wins)
 * - saved: per story, the latest save or un-save
 * - progress: per story, the most recently played run, keeping the best counts
 *   (times finished, first finish, play time)
 * - saga: from whichever side finished that story most recently
 * - "Reset all progress" on either side drops anything older than the reset
 */
export function mergeProfiles(a: ProfileData, b: ProfileData): ProfileData {
  const resetAt = later(a.resetAt, b.resetAt);
  const fresh = (at?: string) => !resetAt || (at ?? "") > resetAt;

  // Only a name/avatar the player actually chose counts: a fresh device's default
  // "Traveller" must never replace the name on their account.
  const pa = a.profile.updatedAt ?? "";
  const pb = b.profile.updatedAt ?? "";
  const profile = pb > pa ? { ...b.profile, id: a.profile.id } : a.profile;

  const saved: Record<string, string> = {};
  const unsaved: Record<string, string> = {};
  const ids = new Set([...Object.keys(a.saved), ...Object.keys(b.saved), ...Object.keys(a.unsaved ?? {}), ...Object.keys(b.unsaved ?? {})]);
  for (const id of ids) {
    const s = later(a.saved[id], b.saved[id]);
    const u = later(a.unsaved?.[id], b.unsaved?.[id]);
    if (s && (!u || s > u)) {
      if (fresh(s)) saved[id] = s;
    } else if (u) unsaved[id] = u;
  }

  const progress: Record<string, StoryProgress> = {};
  const saga: ProfileData["saga"] = {};
  for (const id of new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])) {
    const x = a.progress[id];
    const y = b.progress[id];
    let p: StoryProgress;
    if (!x || !y) p = (x ?? y)!;
    else {
      const recent = y.lastPlayedAt > x.lastPlayedAt ? y : x;
      p = {
        ...recent,
        startedAt: x.startedAt < y.startedAt ? x.startedAt : y.startedAt,
        finishedAt: later(x.finishedAt, y.finishedAt),
        timesFinished: Math.max(x.timesFinished, y.timesFinished),
        secondsPlayed: Math.max(x.secondsPlayed, y.secondsPlayed),
      };
      if (!p.finishedAt) delete p.finishedAt;
    }
    if (!fresh(p.lastPlayedAt)) continue;
    progress[id] = p;
    const fromB = (y?.finishedAt ?? "") > (x?.finishedAt ?? "");
    const exports = fromB ? (b.saga[id] ?? a.saga[id]) : (a.saga[id] ?? b.saga[id]);
    if (exports) saga[id] = exports;
  }

  return {
    version: 1,
    profile,
    saved,
    ...(Object.keys(unsaved).length ? { unsaved } : {}),
    progress,
    saga,
    ...(resetAt ? { resetAt } : {}),
  };
}
