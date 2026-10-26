# Architecture

## Two sides, one contract

```
 AUTHORING (you)                         PLAYERS
 Story source + character library        Player app (web → iOS/Android)
          │ storygames build                     ▲ fetch
          ▼                                      │
 ┌──────────────────── Story Packs (pack-spec) ──┴───┐
 │ pack.json + art/ + characters/   (immutable,      │
 │                                   versioned)      │
 └───────────────────────────────────────────────────┘
        Both sides share: engine (runtime) + pack-spec (format)
```

- **Authoring never ships to players.** The player only ever sees built packs.
- **Story Pack Spec** (`packages/pack-spec`) is the only agreement between the two sides.
  It has a format version (`PACK_FORMAT`); packs declare `minEngine`.
- **Stories are data, puzzle types are code.** New stories can be published any time;
  a new *puzzle type* needs an app update. App stores allow downloading data, not code.

## Package rules

Enforced by `scripts/check-boundaries.mjs` (part of `pnpm check`).

| Package | May use |
|---|---|
| pack-spec | — |
| engine | pack-spec |
| puzzles | engine, pack-spec |
| ui | engine, pack-spec |
| player | engine, pack-spec, puzzles, ui |
| studio (later) | engine, pack-spec, puzzles, ui |
| cli | pack-spec |

`player` and `studio` never import each other. The engine is headless, so the same session
runs in the player, in Studio preview and in tests.

## Engine model

- **Scenes**: a portrait background (1080×1920 canvas units), conditional layers, and hotspots.
- **Actions** (`dialogue`, `puzzle`, `goto`, `set`, `give`, `take`, `end`) run in order.
  `dialogue` and `puzzle` wait for the player. Every action can have an `if`.
- **Conditions**: one language everywhere: `{flag}`, `{flag, is}`, `{has}`, `{solved}`, `{all}`, `{any}`, `{not}`.
- **Dialogue** is ink. Ink VARs named like story flags stay in sync with them.
- **Puzzles** = type (code) + config, skin, hints and onSolve (data). Shown `fullscreen`
  or `inline` (a panel over the scene). Views draw only with theme variables + skin art,
  so the same lock looks native in every story.
- **Branch and bottleneck**: stories are linear (one ending), routes differ through flags
  and conditions. The validator checks the ending is reachable and no scene is a dead end.
- **Characters** live in the library, outside stories. A story *casts* them (picking a variant);
  the build snapshots them into the pack so later library edits never change a published story.
- **Sequels**: a story `exports` flags; a later story `imports` them with defaults. The
  player keeps exports of finished stories in a saga profile.

## Milestones

1. **Walking skeleton** ✅: spec, engine, one puzzle type (both presentations), CLI build, player page, test story.
2. First real story: more puzzle types, debug panel, autosave polish.
3. Publishing: CDN, `catalog.json`, staging/live channels; player library screen.
4. Studio UI: character library, editors, live preview.
5. A sequel sharing a character: saga imports/exports end to end.
6. iOS/Android via Capacitor.
7. Accounts, cloud saves, monetization.
