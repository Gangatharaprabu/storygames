import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { StudioApi } from "./api.ts";

/**
 * Open draft files, shared by every screen that shows them, saved shortly after each change.
 * One copy per file, so the scene list and the scene editor never disagree.
 */
export class Drafts {
  private values = new Map<string, unknown>();
  private loading = new Map<string, Promise<void>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners = new Set<() => void>();
  private pending = new Set<string>();
  /** "saved", "saving" or an error message. */
  status: string = "saved";
  private version = 0;

  constructor(readonly api: StudioApi) {}

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  snapshot = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** The file's value (undefined while loading or missing). Starts loading it if needed. */
  get<T>(key: string): T | undefined {
    if (!this.values.has(key) && !this.loading.has(key)) {
      this.loading.set(
        key,
        this.api.json<T>(key).then(
          (v) => {
            this.values.set(key, v ?? null);
            this.changed();
          },
          (e) => {
            this.status = `Couldn't load ${key.split("/").pop()}: ${(e as Error).message}`;
            this.changed();
          },
        ),
      );
    }
    return (this.values.get(key) ?? undefined) as T | undefined;
  }

  loaded(key: string) {
    return this.values.has(key);
  }

  async load<T>(key: string): Promise<T | undefined> {
    this.get(key);
    await this.loading.get(key);
    return this.get<T>(key);
  }

  set<T>(key: string, value: T) {
    this.values.set(key, value);
    this.pending.add(key);
    this.status = "saving";
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => void this.save(key), 600));
    this.changed();
  }

  private async save(key: string) {
    this.timers.delete(key);
    try {
      await this.api.putJson(key, this.values.get(key));
      this.pending.delete(key);
      if (!this.pending.size) this.status = "saved";
    } catch (e) {
      this.status = `Not saved: ${(e as Error).message}`;
    }
    this.changed();
  }

  /** Save everything now (before building or publishing). */
  async flush() {
    const keys = [...this.timers.keys()];
    keys.forEach((k) => clearTimeout(this.timers.get(k)));
    await Promise.all(keys.map((k) => this.save(k)));
    if (this.pending.size) throw new Error(this.status);
  }

  async remove(key: string) {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    this.pending.delete(key);
    this.values.set(key, null);
    await this.api.delete(key);
    this.changed();
  }

  /** Forget cached files under a prefix (e.g. after someone else changed them). */
  forget(prefix: string) {
    for (const k of [...this.values.keys()]) if (k.startsWith(prefix) && !this.pending.has(k)) this.values.delete(k);
    for (const k of [...this.loading.keys()]) if (k.startsWith(prefix)) this.loading.delete(k);
    this.changed();
  }
}

export interface Studio {
  api: StudioApi;
  drafts: Drafts;
  email: string;
}

export const StudioContext = createContext<Studio | null>(null);
export const useStudio = () => useContext(StudioContext)!;

/** A draft JSON file and a setter that autosaves it. */
export function useDraft<T>(key: string | undefined): [T | undefined, (next: T) => void, boolean] {
  const { drafts } = useStudio();
  useSyncExternalStore(drafts.subscribe, drafts.snapshot);
  const value = key ? drafts.get<T>(key) : undefined;
  return [value, (next: T) => key && drafts.set(key, next), key ? drafts.loaded(key) : true];
}

export function useSaveStatus() {
  const { drafts } = useStudio();
  useSyncExternalStore(drafts.subscribe, drafts.snapshot);
  return drafts.status;
}

/** Re-renders every listener (for lists of files, after adding or removing one). */
export function useRefresh(): [number, () => void] {
  const [n, setN] = useState(0);
  return [n, () => setN((x) => x + 1)];
}

const urls = new Map<string, Promise<string>>();

/** A displayable URL for a file in the bucket (images need the sign-in token, so they're fetched). */
export function useFileUrl(key: string | undefined): string | undefined {
  const { api } = useStudio();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!key) return setUrl(undefined);
    let live = true;
    if (!urls.has(key)) {
      urls.set(
        key,
        api.get(key).then((b) => (b ? URL.createObjectURL(new Blob([b as BlobPart], { type: mime(key) })) : "")),
      );
    }
    void urls.get(key)!.then((u) => live && setUrl(u || undefined));
    return () => {
      live = false;
    };
  }, [api, key]);
  return url;
}

export function forgetFileUrl(key: string) {
  urls.delete(key);
}

export function mime(key: string) {
  const ext = key.split(".").pop()!.toLowerCase();
  return (
    { svg: "image/svg+xml", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", json: "application/json" }[ext] ??
    "application/octet-stream"
  );
}

/** Simple async loader for lists (stories, characters…). */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error?: string; reload: () => void } {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  const [n, reload] = useRefresh();
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ data }),
      (e) => live && setState({ error: (e as Error).message }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload };
}
