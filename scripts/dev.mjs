// pnpm dev [story-dir] [--library <dir>]
// Rebuilds the story on every save and runs the player; the browser reloads by itself.
import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { library: { type: "string" } },
});
const storyDir = positionals[0] ?? "fixtures/test-story";
const library = values.library ?? (storyDir.startsWith("fixtures/") ? "fixtures/library" : "content/library");
const name = basename(resolve(storyDir));
const out = `packages/player/public/packs/${name}`;

const children = [
  spawn(process.execPath, ["packages/cli/bin/storygames.mjs", "watch", storyDir, "--library", library, "--out", out], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@storygames/player", "dev"], { stdio: "inherit", env: { ...process.env, VITE_DEFAULT_PACK: `packs/${name}/` } }),
];
console.log(`\n▶ Playing ${storyDir}: http://localhost:5173/?pack=packs/${name}/&debug\n`);

const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", (code) => { stop(); process.exitCode = code ?? 0; }));
