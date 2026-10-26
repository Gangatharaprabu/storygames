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

## Art

- Portrait canvas: **1080 × 1920**. All `rect`s use these units, origin top-left.
- Phones taller than 9:16 show the theme background above and below the stage.
- Portraits: every expression of a character the same size and framing.
- Interactive objects that change (opened box, picked-up item) are separate layers with an `if`.

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

## Checking your work

`pnpm storygames validate my-story --library library` reports schema errors, unknown
references (scenes, puzzles, items, knots, characters), missing art files, an unreachable
ending and dead-end scenes.
