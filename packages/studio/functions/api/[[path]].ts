// Cloudflare Pages Function: the Studio's file API (see server/api.ts), over the R2 bucket bound as CONTENT.
import { handleApi, supabaseAuthors, type Bucket } from "../../server/api.ts";

interface R2Bucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  head(key: string): Promise<unknown | null>;
  put(key: string, body: ArrayBuffer, options: { httpMetadata: { contentType: string; cacheControl?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: Array<{ key: string }>; truncated: boolean; cursor?: string }>;
}

interface Env {
  CONTENT?: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  STUDIO_AUTHORS?: string;
}

function r2(b: R2Bucket): Bucket {
  return {
    async get(key) {
      const o = await b.get(key);
      return o ? { body: await o.arrayBuffer(), contentType: o.httpMetadata?.contentType } : null;
    },
    async exists(key) {
      return (await b.head(key)) !== null;
    },
    async put(key, body, meta) {
      await b.put(key, body, { httpMetadata: { contentType: meta.contentType, cacheControl: meta.cacheControl } });
    },
    delete: (key) => b.delete(key),
    async list(prefix) {
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await b.list({ prefix, cursor });
        keys.push(...page.objects.map((o) => o.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      return keys.sort();
    },
  };
}

export async function onRequest({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.CONTENT) return new Response(JSON.stringify({ error: "Story storage isn't connected (R2 binding CONTENT missing)." }), { status: 503 });
  return handleApi(request, r2(env.CONTENT), supabaseAuthors(env));
}
