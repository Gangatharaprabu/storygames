# Storygames

A harness for short (5–10 minute) narrative puzzle games: point-and-click, portrait,
anime-styled, with characters that live independently of stories and appear across them.

Stories are **data**. The engine never changes per story: you write a story folder,
the CLI builds it into a **Story Pack**, and the player app plays packs.

```
Story source ──storygames build──▶ Story Pack ──▶ Player (web, later iOS/Android)
(you write)                        (pack.json + art)
```

See [docs/architecture.md](docs/architecture.md) for the design and
[docs/writing-stories.md](docs/writing-stories.md) for how to write a story.

## Quick start

Needs Node 20+ and pnpm.

```sh
pnpm install
pnpm dev          # builds the test story and opens the player at http://localhost:5173
```

Edit anything in `fixtures/test-story/` (for example a line in `narrative/main.ink`), then:

```sh
pnpm build:test-story   # rebuild the pack
```

and refresh the browser. Saves live in the browser's localStorage; use **Play again** at
the end, or clear site data, to start over.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Build the test story and run the player in dev mode |
| `pnpm storygames validate <story> --library <dir>` | Check a story without building |
| `pnpm storygames build <story> --library <dir> --out <dir>` | Build a Story Pack |
| `pnpm check` | Package boundaries + typecheck + unit/integration tests |
| `pnpm test:e2e` | Build the player and play the test story in a real browser (Playwright) |

## Layout

```
packages/
  pack-spec/   THE CONTRACT: Story Pack schemas + validator (structure, references, dead ends)
  engine/      headless runtime: scenes, actions, conditions, ink dialogue, puzzles, saves
  puzzles/     puzzle types; each = logic (headless) + view (skinnable, themed)
  ui/          React player UI: stage, dialogue, puzzle host, inventory (theme-driven)
  player/      the player app (web now; wrapped with Capacitor later)
  cli/         storygames build | validate (publish comes in Milestone 3)
fixtures/
  library/     a tiny character library (Mira, Tomo)
  test-story/  "The Last Ferry", a 3-minute test story with two routes
tests/         integration tests: build the test story and play every route headless
scripts/       check-boundaries.mjs enforces which package may import which
```
