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
pnpm dev        # the app with every story, at http://localhost:5173
```

`pnpm dev` builds every story (the samples in `fixtures/` and yours in `content/`),
rebuilds a story whenever you save one of its files (or a character in the library), and
the browser reloads by itself, resuming where you were. A 🐞 button opens the
**debug panel**: jump to any scene, change flags and items, skip dialogue, solve puzzles.
On the deployed site, add `?debug` to the URL to get the same panel.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Build every story on save and run the app with the debug panel |
| `pnpm build:packs` | Build the sample stories and `catalog.json` (what the public site gets) |
| `pnpm storygames build-all <dir> --library <dir> --out <packs>` | Build every story under a folder and update the catalog |
| `pnpm storygames validate <story> --library <dir>` | Check a story without building |
| `pnpm storygames build <story> --library <dir> --out <dir>` | Build a Story Pack |
| `pnpm storygames watch <story> --library <dir> --out <dir>` | Rebuild on every change |
| `pnpm check` | Package boundaries + typecheck + unit/integration tests |
| `pnpm test:e2e` | Build the player and play the test story in a real browser (Playwright) |

## Layout

```
packages/
  pack-spec/   THE CONTRACT: Story Pack schemas + validator (structure, references, dead ends)
  engine/      headless runtime: scenes, actions, conditions, ink dialogue, puzzles, saves
  puzzles/     puzzle types; each = logic (headless) + view (skinnable, themed)
  ui/          React player UI: stage, dialogue, puzzle host, inventory (theme-driven)
  player/      the app: home, search, story pages, my stories, profile, sharing, and play
               (web now; wrapped with Capacitor later)
  cli/         storygames build | validate (publish comes in Milestone 3)
content/       your stories and characters (see content/README.md)
fixtures/
  library/     a tiny character library (Mira, Tomo)
  test-story/        "The Last Ferry", Mira's Journey ep. 1 (two routes)
  island-lighthouse/ "The Island Lighthouse", ep. 2 (reads ep. 1's choice)
  clockmakers-shop/  "The Clockmaker's Shop", a standalone story
tests/         integration tests: build the test story and play every route headless
scripts/       check-boundaries.mjs enforces which package may import which
```

## Online preview

Every push to `claude/zealous-tesla-3wwgom` or `main` runs `pnpm check`, builds the player
with the test story, and publishes it to GitHub Pages
(`.github/workflows/deploy-pages.yml`). One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. GitHub Pages needs a public repo, or GitHub Pro for
a private one.
