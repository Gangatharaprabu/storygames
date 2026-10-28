import type { ObjectStore, SourceFolder } from "@storygames/builder";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Client for the Studio's file API (functions/_lib/api.ts). */
export class StudioApi {
  constructor(private readonly token: () => Promise<string | undefined>) {}

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.token();
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    const r = await fetch(`./api/${path}`, { ...init, headers });
    if (!r.ok && r.status !== 404) {
      const message = await r.json().then((b: { error?: string }) => b.error, () => undefined);
      throw new ApiError(r.status, message ?? `The Studio server said ${r.status}`);
    }
    return r;
  }

  async me(): Promise<{ email: string }> {
    const r = await this.call("me");
    if (!r.ok) throw new ApiError(r.status, "The Studio server isn't reachable");
    return r.json();
  }

  async list(prefix: string): Promise<string[]> {
    const r = await this.call(`list?prefix=${encodeURIComponent(prefix)}`);
    return ((await r.json()) as { keys: string[] }).keys;
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const r = await this.call(`file/${encodeURIComponent(key)}`);
    return r.status === 404 ? undefined : new Uint8Array(await r.arrayBuffer());
  }

  async text(key: string): Promise<string | undefined> {
    const b = await this.get(key);
    return b && new TextDecoder().decode(b);
  }

  async json<T>(key: string): Promise<T | undefined> {
    const t = await this.text(key);
    return t === undefined ? undefined : (JSON.parse(t) as T);
  }

  async put(key: string, body: Uint8Array | string | Blob, cacheControl?: string) {
    const headers: Record<string, string> = {};
    if (cacheControl) headers["x-cache-control"] = cacheControl;
    await this.call(`file/${encodeURIComponent(key)}`, { method: "PUT", body: body as BodyInit, headers });
  }

  async putJson(key: string, value: unknown) {
    await this.put(key, JSON.stringify(value, null, 2) + "\n");
  }

  async delete(key: string) {
    await this.call(`file/${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  async exists(key: string) {
    const r = await this.call(`file/${encodeURIComponent(key)}`, { method: "HEAD" });
    return r.ok;
  }
}

/** The published-content side of the bucket, for the builder's publish steps. */
export function apiStore(api: StudioApi): ObjectStore {
  return {
    label: "Studio",
    get: (key) => api.get(key),
    put: (key, body, cacheControl) => api.put(key, body, cacheControl),
    exists: (key) => api.exists(key),
    list: (prefix) => api.list(prefix),
  };
}

/**
 * A draft folder (e.g. studio/stories/<id>/) as the builder reads it. The listing is fetched
 * once and files are cached, so a build makes one request per file.
 */
export function draftFolder(api: StudioApi, prefix: string): SourceFolder & { bytes(path: string): Promise<Uint8Array | undefined> } {
  let keys: Promise<Set<string>> | undefined;
  const all = () => (keys ??= api.list(prefix).then((k) => new Set(k.map((x) => x.slice(prefix.length)))));
  const cache = new Map<string, Promise<Uint8Array | undefined>>();
  const bytes = (path: string) => {
    if (!cache.has(path)) cache.set(path, all().then((k) => (k.has(path) ? api.get(prefix + path) : undefined)));
    return cache.get(path)!;
  };
  return {
    bytes,
    async text(path) {
      const b = await bytes(path);
      return b && new TextDecoder().decode(b);
    },
    async exists(path) {
      return (await all()).has(path);
    },
    async list(p) {
      return [...(await all())].filter((k) => k.startsWith(p)).sort();
    },
  };
}
