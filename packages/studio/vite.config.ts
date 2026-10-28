import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import { handleApi, type Bucket } from "./server/api.ts";

/**
 * Locally, the Studio's API runs inside Vite over a folder (.storage at the repo root, the
 * same folder `storygames publish --store .storage` and the player's published mode use).
 * Nobody signs in locally: you're the author.
 */
function localApi(): Plugin {
  const root = resolve(process.env.STUDIO_STORAGE ?? resolve(import.meta.dirname, "../../.storage"));
  const file = (key: string) => join(root, ...key.split("/"));
  const walk = (dir: string): string[] =>
    !existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  const bucket: Bucket = {
    async get(key) {
      if (!existsSync(file(key)) || statSync(file(key)).isDirectory()) return null;
      const b = readFileSync(file(key));
      return { body: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
    },
    async exists(key) {
      return existsSync(file(key));
    },
    async put(key, body) {
      mkdirSync(dirname(file(key)), { recursive: true });
      writeFileSync(file(key), new Uint8Array(body));
    },
    async delete(key) {
      rmSync(file(key), { force: true });
      // Like R2, no empty folders are left behind.
      for (let dir = dirname(file(key)); dir.startsWith(root + sep) && !readdirSync(dir).length; dir = dirname(dir)) rmSync(dir, { recursive: true });
    },
    async list(prefix) {
      const dir = join(root, ...prefix.split("/").slice(0, -1));
      return walk(dir)
        .map((f) => relative(root, f).split(sep).join("/"))
        .filter((k) => k.startsWith(prefix))
        .sort();
    },
  };
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/api/")) return next();
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", async () => {
      try {
        const body = ["GET", "HEAD"].includes(req.method!) ? undefined : Buffer.concat(chunks);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const request = new Request(`http://localhost${req.url}`, { method: req.method, headers, body });
        const response = await handleApi(request, bucket, async () => ({ email: "author@localhost" }));
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  };
  return {
    name: "storygames-studio-local-api",
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  base: "./",
  server: { port: 5174 },
  preview: { port: 4174 },
});
