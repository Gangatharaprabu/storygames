// Enforces the architecture: which workspace packages may import which.
// Checks both package.json dependencies and actual import statements in src/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ALLOWED = {
  "pack-spec": [],
  engine: ["pack-spec"],
  puzzles: ["engine", "pack-spec"],
  ui: ["engine", "pack-spec"],
  player: ["engine", "pack-spec", "puzzles", "ui"],
  builder: ["pack-spec"],
  studio: ["builder", "engine", "pack-spec", "puzzles", "ui"],
  cli: ["builder", "pack-spec"],
};

const root = resolve(import.meta.dirname, "..");
const packagesDir = join(root, "packages");
const problems = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js)$/.test(name) ? [p] : [];
  });

for (const name of readdirSync(packagesDir)) {
  const dir = join(packagesDir, name);
  if (!statSync(dir).isDirectory()) continue;
  const allowed = ALLOWED[name];
  if (!allowed) {
    problems.push(`packages/${name}: not listed in scripts/check-boundaries.mjs`);
    continue;
  }
  const ok = (dep) => allowed.includes(dep);

  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      const m = /^@storygames\/(.+)$/.exec(dep);
      if (m && !ok(m[1])) problems.push(`packages/${name}/package.json: may not depend on ${dep}`);
    }
  }

  for (const file of walk(join(dir, "src"))) {
    const src = readFileSync(file, "utf8");
    for (const [, spec] of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const m = /^@storygames\/([^/]+)/.exec(spec);
      if (m && !ok(m[1])) problems.push(`${relative(root, file)}: may not import ${spec}`);
      if (spec.startsWith(".") && !resolve(file, "..", spec).startsWith(dir + "/")) {
        problems.push(`${relative(root, file)}: relative import leaves the package (${spec})`);
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n✗ ${problems.length} boundary violation(s)`);
  process.exit(1);
}
console.log("✓ package boundaries respected");
