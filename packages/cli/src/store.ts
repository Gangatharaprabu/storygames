import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Where published content lives: a key/value store of files (Cloudflare R2, or a local folder). */
export interface ObjectStore {
  readonly label: string;
  get(key: string): Promise<Buffer | undefined>;
  put(key: string, body: Buffer | string, cacheControl: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

const TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};
export const contentType = (key: string) => TYPES[extname(key).toLowerCase()] ?? "application/octet-stream";

/** A folder on disk laid out exactly like the bucket. For tests and trying publishing locally. */
export function localStore(root: string): ObjectStore {
  const path = (key: string) => join(root, ...key.split("/"));
  const walk = (dir: string): string[] =>
    !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  return {
    label: `folder ${root}`,
    async get(key) {
      return existsSync(path(key)) ? readFileSync(path(key)) : undefined;
    },
    async put(key, body) {
      mkdirSync(dirname(path(key)), { recursive: true });
      writeFileSync(path(key), body);
    },
    async exists(key) {
      return existsSync(path(key));
    },
    async list(prefix) {
      return walk(root)
        .map((f) => relative(root, f).split(sep).join("/"))
        .filter((k) => k.startsWith(prefix))
        .sort();
    },
  };
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Cloudflare R2, through its S3-compatible API. */
export function r2Store(cfg: R2Config): ObjectStore {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  const Bucket = cfg.bucket;
  return {
    label: `R2 bucket ${cfg.bucket}`,
    async get(Key) {
      try {
        const r = await s3.send(new GetObjectCommand({ Bucket, Key }));
        return Buffer.from(await r.Body!.transformToByteArray());
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return undefined;
        throw e;
      }
    },
    async put(Key, body, CacheControl) {
      await s3.send(new PutObjectCommand({ Bucket, Key, Body: body, ContentType: contentType(Key), CacheControl }));
    },
    async exists(Key) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket, Key }));
        return true;
      } catch (e) {
        if ((e as { name?: string }).name === "NotFound" || (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
        throw e;
      }
    },
    async list(Prefix) {
      const keys: string[] = [];
      let ContinuationToken: string | undefined;
      do {
        const r = await s3.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
        keys.push(...(r.Contents ?? []).map((o) => o.Key!));
        ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return keys.sort();
    },
  };
}

/** R2 from environment variables, if they're all set. */
export function r2FromEnv(env = process.env): ObjectStore | undefined {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return undefined;
  return r2Store({ accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET });
}
