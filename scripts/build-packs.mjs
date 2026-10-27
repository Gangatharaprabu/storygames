// Builds every story into packages/player/public/packs/ and writes catalog.json.
//   node scripts/build-packs.mjs            sample stories (fixtures/) only: what the public site gets
//   node scripts/build-packs.mjs --content  also your stories in content/
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

export const OUT = "packages/player/public/packs";
export const SOURCES = [
  { dir: "fixtures", library: "fixtures/library" },
  { dir: "content/series", library: "content/library", private: true },
];

export function buildPacks({ content }) {
  rmSync(OUT, { recursive: true, force: true });
  let ok = true;
  for (const s of SOURCES) {
    if ((s.private && !content) || !existsSync(s.dir)) continue;
    const r = spawnSync(process.execPath, ["packages/cli/bin/storygames.mjs", "build-all", s.dir, "--library", s.library, "--out", OUT], { stdio: "inherit" });
    ok &&= r.status === 0;
  }
  return ok;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(buildPacks({ content: process.argv.includes("--content") }) ? 0 : 1);
}
