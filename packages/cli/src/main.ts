import { parseArgs } from "node:util";
import { buildStory } from "./build.ts";

const USAGE = `storygames <command> <story-dir> --library <dir> [--out <dir>]

Commands:
  build      validate the story and write a Story Pack to --out
  validate   check the story without writing anything`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    library: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const [command, storyDir] = positionals;
if (values.help || !command || !storyDir || !values.library || (command === "build" && !values.out)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}
if (command !== "build" && command !== "validate") {
  console.error(`unknown command "${command}"\n\n${USAGE}`);
  process.exit(1);
}

const result = buildStory({
  storyDir,
  libraryDir: values.library,
  outDir: command === "build" ? values.out : undefined,
});

for (const w of result.warnings) console.warn(`warning  ${w.path}: ${w.message}`);
for (const e of result.errors) console.error(`error    ${e.path}: ${e.message}`);
if (!result.ok) {
  console.error(`\n✗ ${result.errors.length} error(s)`);
  process.exit(1);
}
console.log(command === "build" ? `✓ built ${storyDir} → ${values.out}` : `✓ ${storyDir} is valid`);
