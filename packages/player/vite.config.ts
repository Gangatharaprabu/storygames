import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

/** In dev, reload the page whenever `storygames watch` writes a new pack. */
function reloadOnPackChange(): Plugin {
  return {
    name: "storygames-reload-packs",
    configureServer(server) {
      let timer: NodeJS.Timeout | undefined;
      server.watcher.on("all", (_event, file) => {
        if (!file.replaceAll("\\", "/").includes("/public/packs/") || !file.endsWith("pack.json")) return;
        clearTimeout(timer);
        timer = setTimeout(() => server.ws.send({ type: "full-reload" }), 100);
      });
    },
  };
}

/**
 * Stands in for the Cloudflare function locally: serves a publish folder
 * (`storygames publish --store .storage`) at /content/*, so the "published" mode can be
 * tried with `VITE_CONTENT_MODE=published pnpm dev`.
 */
function localContent(): Plugin {
  const root = resolve(import.meta.dirname, "../../.storage");
  const types: Record<string, string> = { ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith("/content/")) return next();
    const key = decodeURIComponent(req.url.slice("/content/".length).split("?")[0]!);
    const file = join(root, key);
    if (key.includes("..") || key.startsWith("channels/") || !existsSync(file)) {
      res.statusCode = 404;
      return res.end("Not found");
    }
    res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  };
  return {
    name: "storygames-local-content",
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  };
}

export default defineConfig({
  plugins: [react(), reloadOnPackChange(), localContent()],
  // Relative base so the same build works on any host path and inside Capacitor later.
  base: "./",
});
