import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

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

export default defineConfig({
  plugins: [react(), reloadOnPackChange()],
  // Relative base so the same build works on any host path and inside Capacitor later.
  base: "./",
});
