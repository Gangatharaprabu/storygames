import type { SaveData } from "@storygames/engine";
import { mergeProfiles, type ProfileData, type ProfileStore } from "./profile.ts";

/** What the cloud stores for a signed-in player (Supabase in production, a fake in tests). */
export interface Remote {
  loadState(): Promise<ProfileData | undefined>;
  saveState(data: ProfileData): Promise<void>;
  loadSaves(): Promise<SaveData[]>;
  saveGame(save: SaveData): Promise<void>;
  deleteGame(storyId: string): Promise<void>;
}

/** Local game saves, as seen by sync. */
export interface LocalSaves {
  load(storyId: string): SaveData | undefined;
  /** Write without notifying sync (it came from sync). */
  write(save: SaveData): void;
  onChange(l: (storyId: string, save: SaveData | undefined) => void): () => void;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline";

/**
 * Keeps one device's data in step with the player's account:
 * on start, pull + merge + push; after that, push local changes (debounced).
 * Errors (offline, etc.) never block play; the next change or start retries.
 */
export class CloudSync {
  private stops: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingGames = new Map<string, SaveData | undefined>();
  private applying = false;
  status: SyncStatus = "idle";
  onStatus: (s: SyncStatus) => void = () => {};

  constructor(
    private store: ProfileStore,
    private remote: Remote,
    private saves: LocalSaves,
    private delayMs = 1500,
  ) {}

  async start() {
    this.setStatus("syncing");
    try {
      const remote = await this.remote.loadState();
      const merged = remote ? mergeProfiles(this.store.get(), remote) : this.store.get();
      this.applying = true;
      this.store.replace(merged);
      this.applying = false;
      await this.remote.saveState(merged);

      // Saves: whichever is newer wins, per story.
      for (const r of await this.remote.loadSaves()) {
        const local = this.saves.load(r.packId);
        if (!local || r.savedAt > local.savedAt) this.saves.write(r);
        else if (local.savedAt > r.savedAt) await this.remote.saveGame(local);
      }
      // Stories that are finished everywhere shouldn't keep a stale in-progress save.
      for (const [id, p] of Object.entries(merged.progress)) {
        if (p.status === "finished") await this.remote.deleteGame(id).catch(() => {});
      }
      this.setStatus("synced");
    } catch {
      this.applying = false;
      this.setStatus("offline");
    }

    this.stops.push(
      this.store.subscribe(() => {
        if (!this.applying) this.schedule();
      }),
      this.saves.onChange((id, save) => {
        this.pendingGames.set(id, save);
        this.schedule();
      }),
    );
  }

  stop() {
    this.stops.forEach((s) => s());
    this.stops = [];
    clearTimeout(this.timer);
    this.setStatus("idle");
  }

  /** Push now (e.g. when the page is being hidden). */
  async flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.setStatus("syncing");
    try {
      // Merge with whatever other devices pushed meanwhile, so nobody's changes are lost.
      const remote = await this.remote.loadState();
      const merged = remote ? mergeProfiles(this.store.get(), remote) : this.store.get();
      if (JSON.stringify(merged) !== JSON.stringify(this.store.get())) {
        this.applying = true;
        this.store.replace(merged);
        this.applying = false;
      }
      await this.remote.saveState(merged);
      const games = [...this.pendingGames];
      this.pendingGames.clear();
      for (const [id, save] of games) {
        if (save) await this.remote.saveGame(save);
        else await this.remote.deleteGame(id);
      }
      this.setStatus("synced");
    } catch {
      this.applying = false;
      this.setStatus("offline");
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    this.onStatus(s);
  }
}
