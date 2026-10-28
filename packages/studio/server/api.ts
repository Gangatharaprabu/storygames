/**
 * The Studio's file API, over the content bucket. Runs as a Cloudflare Pages Function
 * (functions/api/[[path]].ts) and, for local development, inside Vite (vite.config.ts).
 *
 *   GET    /api/me                      who is signed in
 *   GET    /api/list?prefix=studio/…    keys under a prefix
 *   GET    /api/file/<key>              a file
 *   PUT    /api/file/<key>              write a file (x-cache-control header for published files)
 *   DELETE /api/file/<key>              delete a draft file
 *
 * Drafts live under studio/. Publishing writes packs/, series/, channels/ and catalogs/,
 * the same files the CLI writes. Published pack versions can never be overwritten.
 */

export interface Bucket {
  get(key: string): Promise<{ body: ArrayBuffer; contentType?: string } | null>;
  exists(key: string): Promise<boolean>;
  put(key: string, body: ArrayBuffer, meta: { contentType: string; cacheControl?: string }): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

export type Authorize = (request: Request) => Promise<{ email: string } | Response>;

const READABLE = ["studio/", "packs/", "series/", "channels/", "catalogs/"];
const WRITABLE = ["studio/", "packs/", "series/", "channels/", "catalogs/"];
const MAX_BYTES = 25 * 1024 * 1024;

const TYPES: Record<string, string> = {
  json: "application/json; charset=utf-8",
  ink: "text/plain; charset=utf-8",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};
export const contentType = (key: string) => TYPES[key.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const error = (status: number, message: string) => json({ error: message }, status);

function validKey(key: string, allowed: string[]) {
  return key.length > 0 && key.length < 512 && !key.includes("..") && !key.includes("//") && !key.startsWith("/") && allowed.some((p) => key.startsWith(p));
}

export async function handleApi(request: Request, bucket: Bucket, authorize: Authorize): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  const who = await authorize(request);
  if (who instanceof Response) return who;

  if (path === "me" && request.method === "GET") return json(who);

  if (path === "list" && request.method === "GET") {
    const prefix = url.searchParams.get("prefix") ?? "";
    if (!validKey(prefix, READABLE)) return error(400, "bad prefix");
    return json({ keys: await bucket.list(prefix) });
  }

  if (path.startsWith("file/")) {
    const key = decodeURIComponent(path.slice("file/".length));
    switch (request.method) {
      case "GET":
      case "HEAD": {
        if (!validKey(key, READABLE)) return error(400, "bad key");
        const obj = await bucket.get(key);
        if (!obj) return error(404, "not found");
        const headers = { "content-type": obj.contentType ?? contentType(key), "cache-control": "no-store" };
        return new Response(request.method === "HEAD" ? null : obj.body, { headers });
      }
      case "PUT": {
        if (!validKey(key, WRITABLE)) return error(400, "bad key");
        if (key.startsWith("packs/") && (await bucket.exists(key))) return error(409, "published files never change");
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_BYTES) return error(413, "file too large (25 MB max)");
        await bucket.put(key, body, { contentType: contentType(key), cacheControl: request.headers.get("x-cache-control") ?? undefined });
        return json({ ok: true });
      }
      case "DELETE": {
        if (!validKey(key, ["studio/"])) return error(400, "only drafts can be deleted");
        await bucket.delete(key);
        return json({ ok: true });
      }
    }
  }
  return error(404, "no such endpoint");
}

/** Tokens already checked with Supabase (kept for a few minutes per worker). */
const tokens = new Map<string, { email: string; until: number }>();

/**
 * Hosted: the request must carry a Supabase access token of a Studio author
 * (STUDIO_AUTHORS: comma-separated emails).
 */
export function supabaseAuthors(env: { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; STUDIO_AUTHORS?: string }): Authorize {
  const authors = new Set((env.STUDIO_AUTHORS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  return async (request) => {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return error(503, "Studio sign-in isn't configured (SUPABASE_URL / SUPABASE_ANON_KEY).");
    if (!authors.size) return error(403, "No Studio authors yet: add your email to the STUDIO_AUTHORS variable.");
    const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return error(401, "Sign in first.");
    const hit = tokens.get(token);
    let email = hit && hit.until > Date.now() ? hit.email : undefined;
    if (!email) {
      const base = env.SUPABASE_URL.replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
      const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } });
      if (!r.ok) return error(401, "Your sign-in has expired. Sign in again.");
      email = ((await r.json()) as { email?: string }).email?.toLowerCase();
      if (!email) return error(401, "Sign in with an email address.");
      if (tokens.size > 500) tokens.clear();
      tokens.set(token, { email, until: Date.now() + 5 * 60_000 });
    }
    if (!authors.has(email)) return error(403, `${email} isn't a Studio author. Add it to STUDIO_AUTHORS.`);
    return { email };
  };
}
