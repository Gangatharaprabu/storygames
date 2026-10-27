# Content

Your stories and characters. Code lives in `packages/`; nothing in here is code.

```
content/
  library/
    characters/<id>/        one folder per character, shared by every story
      character.json
      portraits/
  series/
    <series-id>/
      <episode-folder>/     one story (same layout as fixtures/test-story)
```

Work on a story with live reload and the debug panel:

```sh
pnpm dev content/series/<series-id>/<episode-folder>
```

Check it without running anything:

```sh
pnpm storygames validate content/series/<series-id>/<episode-folder> --library content/library
```

The public GitHub Pages site only publishes the test story in `fixtures/`, never anything
in this folder.
