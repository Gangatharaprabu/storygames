import { watch } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildStory, type BuildResult } from "./build.ts";

const USAGE = `storygames <command> <story-dir> --library <dir> [--out <dir>]

Commands:
  build      validate the story and write a Story Pack to --out
  validate   check the story without writing anything
  watch      build, then rebuild whenever the story or library changes`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    library: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const [command, storyDir] = positionals;
const needsOut = command === "build" || command === "watch";
if (values.help || !command || !storyDir || !values.library || (needsOut && !values.out)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
if (!["build", "validate", "watch"].includes(command)) {
  console.error(`unknown command "${command}"\n\n${USAGE}`);
  process.exit(1);
}

function report(result: BuildResult) {
  for (const w of result.warnings) console.warn(`warning  ${w.path}: ${w.message}`);
  for (const e of result.errors) console.error(`error    ${e.path}: ${e.message}`);
}

const run = () =>
  buildStory({ storyDir, libraryDir: values.library!, outDir: command === "validate" ? undefined : values.out });

if (command !== "watch") {
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
      if (result.ok) console.log(`✓ [${time}] rebuilt in ${Date.now() - started}ms`);
      else console.error(`✗ [${time}] ${result.errors.length} error(s), the previous build stays in place`);
    } catch (e) {
      console.error(`✗ build crashed: ${(e as Error).message}`);
    }
    building = false;
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
  console.log(`watching ${storyDir} and ${values.library} (Ctrl+C to stop)`);
  await rebuild();
}
