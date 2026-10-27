/**
 * Cloudflare Pages Function: serves published stories from the R2 bucket bound as CONTENT.
 *   GET /content/catalogs/live.json          → R2 key catalogs/live.json
 *   GET /content/packs/<story>/<ver>/…       → R2 key packs/<story>/<ver>/…
 * Same origin as the app (no CORS), cached at Cloudflare's edge using the cache headers
 * the publisher stored with each file (versioned packs: a year; catalogs: a minute).
 */

interface R2Object {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  get(key: string, options?: { onlyIf?: Headers }): Promise<(R2Object & { body?: ReadableStream }) | null>;
}
interface Context {
  request: Request;
  env: { CONTENT?: R2Bucket };
  params: { path?: string | string[] };
}

export async function onRequestGet({ request, env, params }: Context): Promise<Response> {
  if (!env.CONTENT) return new Response("Story storage isn't connected (R2 binding CONTENT missing).", { status: 503 });
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const key = parts.map(decodeURIComponent).join("/");
  if (!key || key.includes("..") || key.startsWith("channels/")) return new Response("Not found", { status: 404 });

  const object = await env.CONTENT.get(key, { onlyIf: request.headers });
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  // No body means the If-None-Match / If-Modified-Since precondition matched.
  if (!("body" in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}
