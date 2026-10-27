import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildStory, type BuildResult } from "./build.ts";
import { SERIES_DIR, writeCatalog } from "./catalog.ts";
import { SeriesSource } from "./source.ts";

const USAGE = `storygames <command> <story-dir> --library <dir> [--out <dir>]

Commands:
  build      validate the story and write a Story Pack to --out
  validate   check the story without writing anything
  watch      build, then rebuild whenever the story or library changes
  build-all  build every story found under <dir> into --out/<story id>/ and update
             --out/catalog.json (the list of stories the app shows)
  catalog    rewrite <packs-dir>/catalog.json from the packs already in it`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    library: { type: "string" },
    out: { type: "string" },
    "quiet-start": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const [command, storyDir] = positionals;
if (command === "catalog" && storyDir) {
  const catalog = writeCatalog(storyDir);
  console.log(`✓ catalog: ${catalog.stories.length} stories`);
  process.exit(0);
}
const needsOut = command === "build" || command === "watch" || command === "build-all";
if (values.help || !command || !storyDir || !values.library || (needsOut && !values.out)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
if (!["build", "validate", "watch", "build-all"].includes(command)) {
  console.error(`unknown command "${command}"\n\n${USAGE}`);
  process.exit(1);
}

function report(result: BuildResult) {
  for (const w of result.warnings) console.warn(`warning  ${w.path}: ${w.message}`);
  for (const e of result.errors) console.error(`error    ${e.path}: ${e.message}`);
}

const run = () =>
  buildStory({ storyDir, libraryDir: values.library!, outDir: command === "validate" ? undefined : values.out });

if (command === "build-all") {
  const stories = findStories(storyDir);
  let failed = 0;
  for (const dir of stories) {
    const id = JSON.parse(readFileSync(join(dir, "story.json"), "utf8")).id as string;
    const result = await buildStory({ storyDir: dir, libraryDir: values.library!, outDir: join(values.out!, id) });
    report(result);
    if (result.ok) console.log(`✓ ${dir} → ${values.out}/${id}`);
    else {
      failed++;
      console.error(`✗ ${dir}: ${result.errors.length} error(s)`);
    }
  }
  // Series descriptions (series.json anywhere under the folder) go next to the packs.
  for (const file of findFiles(storyDir, "series.json")) {
    const parsed = SeriesSource.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      failed++;
      console.error(`✗ ${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    mkdirSync(join(values.out!, SERIES_DIR), { recursive: true });
    copyFileSync(file, join(values.out!, SERIES_DIR, `${parsed.data.id}.json`));
  }
  if (existsSync(values.out!)) {
    const catalog = writeCatalog(values.out!);
    console.log(`✓ catalog: ${catalog.stories.length} stories`);
  }
  process.exit(failed ? 1 : 0);
} else if (command !== "watch") {
  const result = await run();
  report(result);
  if (!result.ok) {
    console.error(`\n✗ ${result.errors.length} error(s)`);
    process.exit(1);
  }
  console.log(command === "build" ? `✓ built ${storyDir} → ${values.out}` : `✓ ${storyDir} is valid`);
} else {
  let timer: NodeJS.Timeout | undefined;
  let building = false;
  let again = false;
  let first = true;
  const rebuild = async () => {
    if (building) {
      again = true;
      return;
    }
    building = true;
    const started = Date.now();
    try {
      const result = await run();
      report(result);
      const time = new Date().toLocaleTimeString();
      if (result.ok) {
        const packsDir = resolve(values.out!, "..");
        if (existsSync(join(packsDir, "catalog.json"))) writeCatalog(packsDir);
        if (!(first && values["quiet-start"])) console.log(`✓ [${time}] ${storyDir} rebuilt in ${Date.now() - started}ms`);
      }
      else console.error(`✗ [${time}] ${result.errors.length} error(s), the previous build stays in place`);
    } catch (e) {
      console.error(`✗ build crashed: ${(e as Error).message}`);
    }
    building = false;
    first = false;
    if (again) {
      again = false;
      void rebuild();
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  };
  for (const dir of [storyDir, values.library!]) watch(resolve(dir), { recursive: true }, schedule);
  if (!values["quiet-start"]) console.log(`watching ${storyDir} and ${values.library} (Ctrl+C to stop)`);
  await rebuild();
}

/** Every folder under `root` (or `root` itself) that contains a story.json. */
function findStories(root: string): string[] {
  if (!existsSync(root)) return [];
  if (existsSync(join(root, "story.json"))) return [root];
  return readdirSync(root)
    .filter((n) => !n.startsWith(".") && statSync(join(root, n)).isDirectory())
    .sort()
    .flatMap((n) => findStories(join(root, n)));
}

/** Every file called `name` under `root`. */
function findFiles(root: string, name: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((n) => {
    const p = join(root, n);
    if (n.startsWith(".")) return [];
    if (statSync(p).isDirectory()) return findFiles(p, name);
    return n === name ? [p] : [];
  });
}
