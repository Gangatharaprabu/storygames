# Writing a story

A story is a folder. Characters live outside it, in the library.

```
library/characters/<id>/
  character.json          name, colour, bio, variants → portraits
  portraits/*.png|svg
my-story/
  story.json              title, cast, startScene, flags, exports/imports, items
  theme.json              colours, fonts, corner radius, colour grade
  scenes/*.json           one file per scene
  puzzles/*.json          one file per puzzle
  narrative/main.ink      dialogue (may INCLUDE other .ink files)
  art/                    backgrounds, layers, item icons, puzzle skins
```

`fixtures/test-story` is a complete, small example of every piece.

## Series, sequels and spin-offs

- An episode says which series it belongs to: `"series": { "id": "miras-journey", "title": "Mira's Journey", "episode": 2 }`.
- Describe a series once in a `series.json` anywhere in your content (e.g.
  `content/series/miras-journey/series.json`): `{ "id", "title", "synopsis" }`.
- `"follows": ["the-last-ferry"]` says which stories this one carries on from. When the
  story it follows is in **another series**, this story starts a **spin-off**: the app
  shows "Continues from Mira's Journey" on the new series and "The story continues in…"
  on the old one, and "What happens next" on the story it follows.
- `imports` (choices carried over from earlier stories) count as following too.
- Characters are shared: the same library character can lead one series and appear in
  another. Their page lists every story and series they're in. Give them a `bio` in
  `character.json`; it's shown on that page.

## Art

- Drop in PNG or JPG straight from your image tool; the build converts them to WebP and
  scales them to fit 1080 × 1920, so a 2–4 MB render becomes ~100–300 KB. SVG is kept as is.
  The build warns when a background isn't 9:16 or is too small to look sharp.
- Portrait canvas: **1080 × 1920**. All `rect`s use these units, origin top-left.
- Phones taller than 9:16 show the theme background above and below the stage.
- Portraits: every expression of a character the same size and framing.
- Sprites (optional): full-body art per expression, for characters who stand in a scene
  (`"sprites": { "neutral": "sprites/neutral.png" }` next to `portraits` in `character.json`).
  Feet on the bottom edge, roughly 1:2 wide-to-tall. Without sprites, the portrait is used.
- Interactive objects that change (opened box, picked-up item) are separate layers with an `if`.

## Sound

- `"music": "audio/harbour.mp3"` on a scene loops it, fading between scenes. Scenes that
  name the same file keep it playing without a restart.
- `theme.json` → `"sounds": { "tap": …, "solve": …, "wrong": … }` for UI sounds.
- Prefer `.mp3` or `.m4a` (much smaller than `.wav`). Players can mute with the 🔊 button.

## Dialogue (ink)

```ink
VAR helped_ferryman = false   // same name as a flag in story.json → kept in sync

=== tomo ===
tomo: Evening. The ferry's chained for the night.     // "id:" or "Name:" = speaker
mira: Please, I have to cross tonight. #worried       // portrait tag = expression
* [Offer to help]
    ~ helped_ferryman = true
* [Insist]
    tomo: Then find your own way. #grumpy
- -> DONE
```

`#give:rope` / `#take:rope` change the inventory. Lines with no speaker are narration.
End knots with `-> DONE`.

## Scenes

```json
{
  "id": "harbour",
  "background": "art/harbour.svg",
  "layers": [{ "id": "box-open", "image": "art/box-open.svg", "rect": {…}, "if": { "solved": "tackle-box" } }],
  "onEnter": [{ "do": "dialogue", "knot": "arrival", "if": { "not": { "flag": "arrived" } } }],
  "hotspots": [{ "id": "ferry", "label": "The chained ferry", "rect": {…}, "actions": [{ "do": "puzzle", "puzzle": "ferry-lock" }] }]
}
```

## Cinematics: scenes that play like an anime

Every scene **arrives** and **leaves** with a transition, and its `onEnter` plays as a
cutscene (black bars, no tapping around) until it's the player's turn, when the bars lift
and "Tap around to explore" appears. Dialogue and puzzles stop the cutscene for the player;
anything else plays for its time, and a tap skips it.

```json
{
  "id": "harbour",
  "enter": { "type": "fade-black", "ms": 1200 },
  "exit": { "type": "fade-black", "ms": 600 },
  "camera": { "x": 540, "y": 960, "zoom": 1 },
  "onEnter": [
    { "do": "camera", "y": 380, "zoom": 1.8, "ms": 0 },
    { "do": "title", "text": "The Last Ferry", "subtitle": "Episode 1" },
    { "do": "camera", "y": 960, "zoom": 1, "ms": 2600 },
    { "do": "enter", "character": "mira", "at": "left", "from": "left" },
    { "do": "dialogue", "knot": "arrival" },
    { "do": "exit", "character": "mira", "to": "left" }
  ]
}
```

| Action | What it does |
|---|---|
| `wait` `ms` | A pause. |
| `camera` `x` `y` `zoom` `ms` | Pans/zooms to a point of the 1080 × 1920 scene (zoom 1–4). |
| `enter` `character` `at` `from` `expression` | A character walks on (`from`: left, right, bottom, fade). Positions: far-left, left, center, right, far-right. |
| `move` `character` `to` | Walks to another position. |
| `expression` `character` `expression` | Changes their face without dialogue. |
| `exit` `character` `to` | Walks off. |
| `title` `text` `subtitle` `ms` | A title card. |
| `effect` `effect` `ms` | `shake`, `flash` or `flash-black`. |
| `goto` `scene` `transition` | Leaves through this scene's `exit` (or `transition`), arrives through the next scene's `enter`. |

- Transitions: `none`, `fade`, `fade-black`, `fade-white`, `slide-left`, `slide-right`, `slide-up`, `zoom`, `iris`, `wipe`.
- `camera`, `enter`, `move` and `exit` take `"wait": false` to happen while the story carries on
  (e.g. a slow pan under dialogue). With `"ms": 0` they happen instantly; at the start of
  `onEnter` they're applied before the scene fades in, so it opens already framed.
- While a character on stage speaks, they're lit and others dim; their dialogue uses the sprite, not a close-up.
- Players who ask their device for reduced motion get instant cuts (titles and waits still pause).

## Puzzles

```json
{
  "id": "ferry-lock",
  "type": "combination-lock",
  "presentation": "fullscreen",
  "config": { "dials": 3, "solution": ["3", "1", "4"] },
  "skin": { "body": "art/lock-body.svg" },
  "hints": ["gentle", "clearer", "the answer"],
  "onSolve": [{ "do": "goto", "scene": "at-sea" }]
}
```

`inline` puzzles also need a `rect` (position and width over the scene). Every fullscreen
puzzle accepts a `backdrop` skin slot.

### Puzzle types

| Type | Config | Skin slots |
|---|---|---|
| `combination-lock` | `dials`, `solution`, optional `symbols` (default 0–9) | `body`, `dial` |

## Testing your story

`pnpm dev <story-dir>` rebuilds on every save and reloads the browser where you were.
The 🐞 debug panel jumps to any scene, toggles flags, items and solved puzzles, skips
dialogue and solves the open puzzle, so you can test the last scene without replaying.

## Checking your work

`pnpm storygames validate my-story --library library` reports schema errors, unknown
references (scenes, puzzles, items, knots, characters), missing art files, an unreachable
ending and dead-end scenes.
