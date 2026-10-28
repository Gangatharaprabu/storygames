import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildStory, type BuildResult } from "./build.ts";
import { SERIES_DIR, writeCatalog } from "./catalog.ts";
import { SeriesSource } from "@storygames/builder";
import { CHANNELS, promote, publish, PublishError, rollback, status, unpublish, type Channel } from "./publish.ts";
import { localStore, r2FromEnv, type ObjectStore } from "./store.ts";
import { importToStudio } from "./studio-import.ts";

// Keys for R2 can live in a git-ignored .env file next to package.json.
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* ignore malformed files */
    }
  }
}

const USAGE = `storygames <command> <story-dir> --library <dir> [--out <dir>]

Commands:
  build      validate the story and write a Story Pack to --out
  validate   check the story without writing anything
  watch      build, then rebuild whenever the story or library changes
  build-all  build every story found under <dir> into --out/<story id>/ and update
             --out/catalog.json (the list of stories the app shows)
  catalog    rewrite <packs-dir>/catalog.json from the packs already in it

Publishing (to Cloudflare R2 from R2_* env vars / .env, or a local folder with --store <dir>):
  publish <story-dir> --library <dir> [--channel staging|live]
             upload the story as a new version and put it in a channel (default: staging)
  promote <story-id>              put the staging version live
  rollback <story-id> --to <version> [--channel live]
             point a channel back at an earlier version
  unpublish <story-id> --channel <staging|live>
             take a story out of a channel (its files are kept)
  status     every story's staging and live version
  studio-import <story-dir> --library <dir>
             copy a story (and its characters and series) into the Studio's drafts`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    library: { type: "string" },
    out: { type: "string" },
    "quiet-start": { type: "boolean" },
    store: { type: "string" },
    channel: { type: "string" },
    to: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const [command, storyDir] = positionals;
if (command && ["publish", "promote", "rollback", "unpublish", "status", "studio-import"].includes(command)) {
  process.exit(await publishing(command, storyDir));
}
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

async function publishing(cmd: string, arg: string | undefined): Promise<number> {
  const store: ObjectStore | undefined = values.store ? localStore(values.store) : r2FromEnv();
  if (!store) {
    console.error("No store: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET (or a .env file), or pass --store <folder>.");
    return 1;
  }
  const channel = (values.channel ?? (cmd === "publish" ? "staging" : "live")) as Channel;
  if (!CHANNELS.includes(channel)) {
    console.error(`--channel must be one of: ${CHANNELS.join(", ")}`);
    return 1;
  }
  try {
    switch (cmd) {
      case "publish": {
        if (!arg || !values.library) {
          console.log(USAGE);
          return 1;
        }
        console.log(`Publishing ${arg} to ${channel} (${store.label})`);
        const libraryRoot = resolve(values.library, "..");
        const r = await publish({ store, storyDir: arg, libraryDir: values.library, seriesRoots: [libraryRoot], channel, log: console.log });
        report(r.build);
        if (!r.build.ok) {
          console.error(`\n✗ ${r.build.errors.length} error(s), nothing was published`);
          return 1;
        }
        console.log(`✓ ${r.story} ${r.version} is in ${channel}`);
        if (channel === "staging") console.log(`  Check it on the staging site, then: storygames promote ${r.story}`);
        return 0;
      }
      case "studio-import": {
        if (!arg || !values.library) return usage();
        console.log(`Copying ${arg} into the Studio (${store.label})`);
        const id = await importToStudio({ store, storyDir: arg, libraryDir: values.library, seriesRoots: [resolve(values.library, "..")], log: console.log });
        console.log(`✓ ${id} is in the Studio`);
        return 0;
      }
      case "promote": {
        if (!arg) return usage();
        const version = await promote(store, arg);
        console.log(`✓ ${arg} ${version} is live`);
        return 0;
      }
      case "rollback": {
        if (!arg || !values.to) return usage();
        await rollback(store, arg, values.to, channel);
        console.log(`✓ ${channel} now has ${arg} ${values.to}`);
        return 0;
      }
      case "unpublish": {
        if (!arg || !values.channel) return usage();
        await unpublish(store, arg, channel);
        console.log(`✓ ${arg} removed from ${channel} (its files are kept)`);
        return 0;
      }
      default: {
        const rows = await status(store);
        if (!rows.length) console.log(`Nothing published yet (${store.label}).`);
        for (const r of rows) {
          console.log(`${r.story.padEnd(28)} staging ${(r.staging ?? "—").padEnd(9)} live ${(r.live ?? "—").padEnd(9)} versions: ${r.versions.join(", ")}`);
        }
        return 0;
      }
    }
  } catch (e) {
    if (e instanceof PublishError) {
      console.error(`✗ ${e.message}`);
      return 1;
    }
    throw e;
  }
}

function usage() {
  console.log(USAGE);
  return 1;
}
