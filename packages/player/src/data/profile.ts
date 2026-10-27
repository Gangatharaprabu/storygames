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
  profile: { id: string; name: string; avatar: string; createdAt: string };
  /** storyId → when it was saved */
  saved: Record<string, string>;
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

  rename(name: string) {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed) this.update((d) => ({ ...d, profile: { ...d.profile, name: trimmed } }));
  }

  setAvatar(avatar: string) {
    this.update((d) => ({ ...d, profile: { ...d.profile, avatar } }));
  }

  isSaved = (storyId: string) => storyId in this.data.saved;

  toggleSaved(storyId: string, now = new Date()) {
    this.update((d) => {
      const saved = { ...d.saved };
      if (storyId in saved) delete saved[storyId];
      else saved[storyId] = now.toISOString();
      return { ...d, saved };
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

  resetAll() {
    const keep = this.data.profile;
    this.update(() => ({ ...newProfile(), profile: keep }));
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
