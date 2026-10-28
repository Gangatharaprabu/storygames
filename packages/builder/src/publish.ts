import { z } from "zod";
import { Id, StoryPack, type Catalog } from "@storygames/pack-spec";
import { buildCatalog, type CatalogInput } from "./catalog.ts";
import { SeriesSource } from "./source.ts";

/*
 * Layout of published content (the R2 bucket, or a local folder for testing):
 *
 *   packs/<story>/<version>/pack.json, art/…, characters/…, audio/…   never changes once written
 *   series/<series>.json                                              series descriptions
 *   channels/<channel>.json                                           which version of each story is in the channel
 *   catalogs/<channel>.json                                           what the app reads (generated from the channel)
 *
 * Every path inside a catalog is relative to the content root.
 */

/** Where published content lives: a key/value store of files (Cloudflare R2, a local folder, the Studio's API). */
export interface ObjectStore {
  readonly label: string;
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, body: Uint8Array | string, cacheControl: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

export const CHANNELS = ["staging", "live"] as const;
export type Channel = (typeof CHANNELS)[number];

export const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60";

const ChannelFile = z.object({
  channel: z.enum(CHANNELS),
  updatedAt: z.string(),
  stories: z.record(Id, z.object({ version: z.string(), publishedAt: z.string() })),
  history: z.array(z.object({ at: z.string(), action: z.string(), story: Id, version: z.string().optional() })),
});
type ChannelFile = z.infer<typeof ChannelFile>;

export const packPrefix = (story: string, version: string) => `packs/${story}/${version}/`;

export class PublishError extends Error {}

const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const encode = (s: string) => new TextEncoder().encode(s);

export async function readChannel(store: ObjectStore, channel: Channel): Promise<ChannelFile> {
  const raw = await store.get(`channels/${channel}.json`);
  return raw
    ? ChannelFile.parse(JSON.parse(decode(raw)))
    : { channel, updatedAt: new Date(0).toISOString(), stories: {}, history: [] };
}

/** Versions of a story already in the store, oldest first. */
export async function publishedVersions(store: ObjectStore, story: string): Promise<string[]> {
  const keys = await store.list(`packs/${story}/`);
  const versions = new Set(keys.filter((k) => k.endsWith("/pack.json")).map((k) => k.split("/")[2]!));
  return [...versions].sort(compareVersions);
}

/**
 * Upload a built story as a new, never-changing version, then add it to a channel
 * (staging by default). Publishing a version that already exists is refused unless it is
 * byte-for-byte the same story (so re-running a publish is harmless).
 */
export async function publishPack(opts: {
  store: ObjectStore;
  pack: StoryPack;
  /** Every file of the pack except pack.json, with its path inside the pack. */
  files: Array<{ path: string; body: Uint8Array }>;
  series?: Array<z.infer<typeof SeriesSource>>;
  channel?: Channel;
  log?: (line: string) => void;
}): Promise<{ story: string; version: string }> {
  const { store, pack, channel = "staging", log = () => {} } = opts;
  const { id, version } = pack.manifest;
  const prefix = packPrefix(id, version);
  const fresh = encode(JSON.stringify(pack));

  const existing = await store.get(`${prefix}pack.json`);
  if (existing) {
    if (!sameBytes(existing, fresh)) {
      throw new PublishError(
        `${id} ${version} is already published with different content. Published versions never change: raise the version (e.g. ${bump(version)}).`,
      );
    }
    log(`  ${id} ${version} is already uploaded (unchanged)`);
  } else {
    // pack.json last, so a version only "exists" once all its files are there.
    for (const f of opts.files) await store.put(prefix + f.path, f.body, IMMUTABLE);
    await store.put(`${prefix}pack.json`, fresh, IMMUTABLE);
    log(`  uploaded ${opts.files.length + 1} files to ${prefix}`);
  }

  for (const series of opts.series ?? []) {
    await store.put(`series/${series.id}.json`, JSON.stringify(series), "public, max-age=300");
  }

  await setPin(store, channel, id, version, "publish");
  return { story: id, version };
}

/** Put the version of a story that's in staging (or a given version) into live. */
export async function promote(store: ObjectStore, story: string, opts: { version?: string; from?: Channel; to?: Channel } = {}) {
  const { from = "staging", to = "live" } = opts;
  const version = opts.version ?? (await readChannel(store, from)).stories[story]?.version;
  if (!version) throw new PublishError(`${story} isn't in ${from}. Publish it first.`);
  await setPin(store, to, story, version, opts.version ? "rollback" : "promote");
  return version;
}

/** Point a channel at an earlier published version of a story. */
export async function rollback(store: ObjectStore, story: string, version: string, channel: Channel = "live") {
  await setPin(store, channel, story, version, "rollback");
}

/** Take a story out of a channel. Its files stay, so it can be put back. */
export async function unpublish(store: ObjectStore, story: string, channel: Channel) {
  const ch = await readChannel(store, channel);
  if (!ch.stories[story]) throw new PublishError(`${story} isn't in ${channel}`);
  delete ch.stories[story];
  ch.history.push({ at: new Date().toISOString(), action: "unpublish", story });
  await writeChannel(store, ch);
}

export async function status(store: ObjectStore) {
  const [staging, live] = await Promise.all([readChannel(store, "staging"), readChannel(store, "live")]);
  const ids = [...new Set([...Object.keys(staging.stories), ...Object.keys(live.stories)])].sort();
  return Promise.all(
    ids.map(async (id) => ({
      story: id,
      staging: staging.stories[id]?.version,
      live: live.stories[id]?.version,
      versions: await publishedVersions(store, id),
    })),
  );
}

async function setPin(store: ObjectStore, channel: Channel, story: string, version: string, action: string) {
  if (!(await store.exists(`${packPrefix(story, version)}pack.json`))) {
    throw new PublishError(`${story} ${version} was never published (have: ${(await publishedVersions(store, story)).join(", ") || "none"})`);
  }
  const ch = await readChannel(store, channel);
  const now = new Date().toISOString();
  ch.stories[story] = { version, publishedAt: ch.stories[story]?.version === version ? ch.stories[story]!.publishedAt : now };
  ch.history.push({ at: now, action, story, version });
  await writeChannel(store, ch);
}

async function writeChannel(store: ObjectStore, ch: ChannelFile) {
  ch.updatedAt = new Date().toISOString();
  ch.history = ch.history.slice(-200);
  await store.put(`channels/${ch.channel}.json`, JSON.stringify(ch, null, 2), SHORT);
  await store.put(`catalogs/${ch.channel}.json`, JSON.stringify(await catalogFor(store, ch)), SHORT);
}

/** The catalog for a channel: the pinned version of every story in it. */
export async function catalogFor(store: ObjectStore, ch: ChannelFile): Promise<Catalog> {
  const inputs: CatalogInput[] = [];
  for (const [story, pin] of Object.entries(ch.stories)) {
    const prefix = packPrefix(story, pin.version);
    const raw = await store.get(`${prefix}pack.json`);
    if (!raw) throw new PublishError(`${prefix}pack.json is missing from the store`);
    inputs.push({ folder: prefix, pack: StoryPack.parse(JSON.parse(decode(raw))), publishedAt: pin.publishedAt });
  }
  const series = [];
  for (const key of await store.list("series/")) {
    const raw = await store.get(key);
    if (raw) series.push(SeriesSource.parse(JSON.parse(decode(raw))));
  }
  return buildCatalog(inputs, series);
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export function bump(version: string) {
  const [a = 0, b = 0, c = 0] = version.split(".").map(Number);
  return `${a}.${b}.${c + 1}`;
}
