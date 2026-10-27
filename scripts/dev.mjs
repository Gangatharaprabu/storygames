// pnpm dev
// Builds every story (samples + content/), rebuilds each one on save, and runs the player.
// The browser reloads by itself; the debug panel (🐞) is on.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildPacks, OUT, SOURCES } from "./build-packs.mjs";

buildPacks({ content: true });

const findStories = (root) =>
  !existsSync(root) ? [] : existsSync(join(root, "story.json")) ? [root]
    : readdirSync(root).filter((n) => !n.startsWith(".") && statSync(join(root, n)).isDirectory()).flatMap((n) => findStories(join(root, n)));

const children = [];
for (const s of SOURCES) {
  for (const dir of findStories(s.dir)) {
    const id = JSON.parse(readFileSync(join(dir, "story.json"), "utf8")).id;
    children.push(spawn(process.execPath, ["packages/cli/bin/storygames.mjs", "watch", dir, "--library", s.library, "--out", join(OUT, id), "--quiet-start"], { stdio: "inherit" }));
  }
}
children.push(spawn("pnpm", ["--filter", "@storygames/player", "dev"], { stdio: "inherit" }));
console.log(`\n▶ Open http://localhost:5173/  (edit any story file and the page reloads)\n`);

const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", (code) => { if (code) { stop(); process.exitCode = code; } }));
