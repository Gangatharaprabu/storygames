# Storygames Studio

The Studio is where you write stories: characters, scenes, dialogue, puzzles and art, then
play them and publish them. It's a website of its own (separate from the player app), and
only the emails you list can sign in.

```
 Studio (storygames-studio Pages project)        Player app (storygames Pages project)
   write → drafts in R2 (studio/…)                   reads published stories only
   Play: builds the drafts in your browser
   Publish: builds → packs/<id>/<version>/ ───────►  catalogs/staging.json, catalogs/live.json
```

Drafts and published stories share one R2 bucket, but the player app only ever serves
`packs/`, `series/` and `catalogs/`: nobody sees a draft.

## Setting it up (once)

1. **Say who can sign in.** GitHub → your repository → **Settings → Secrets and variables →
   Actions → Variables** → **New repository variable**:
   - Name: `STUDIO_AUTHORS`
   - Value: your email (several: separate with commas)

   Use the email you signed in to the Storygames app with. The Studio doesn't create
   accounts: sign in to the app once first.
2. **Deploy.** Every push deploys the Studio too (workflow *Deploy app to Cloudflare Pages*).
   After a variable change, re-run that workflow (**Actions → Deploy app to Cloudflare Pages →
   Run workflow**). The run's last step prints the Studio's address
   (`https://storygames-studio….pages.dev`).
3. **Let the sign-in email bring you back to the Studio** (optional: the code in the email
   works without it). Supabase → **Authentication → URL Configuration → Redirect URLs** → add
   the Studio's address followed by `/**`.
4. **Bring in the stories you already have** (optional): **Actions → Stories → Run workflow**
   → *What to do*: `copy-to-studio`, *story*: e.g.
   `fixtures/test-story, fixtures/island-lighthouse, fixtures/night-watch, fixtures/clockmakers-shop`.
   Their characters and series come along. Copying again overwrites the Studio's copy.

## Writing a story

**Stories → + New story.** You get a first scene with placeholder art and a first line of
dialogue, so it plays straight away. Then, down the left:

| Tab | What you do there |
|---|---|
| Overview | Title, synopsis, tags, cover, series and episode, which stories it carries on from, and the cast (picked from the character library). |
| Scenes | Background and music. **Drag on the picture** to mark a hotspot, then say what tapping it does (a conversation, a puzzle, going to another scene, ending the story…). Layers are pictures over the background that can appear later (an opened box). **Opening**: how the scene arrives and leaves, and the cutscene that plays on arrival (title card, camera moves, characters walking in, dialogue). |
| Dialogue | Conversations, line by line: who speaks, their expression, the text. **Choice** gives the player options, each with its own lines; **If…** checks a flag; you can set flags and give or take items mid-conversation. |
| Puzzles | Combination locks (digits, letters or symbols), full screen or as a panel over the scene, with hints and what happens when solved. |
| Flags & items | What the story remembers (`talked_to_tomo`), which of those carry into sequels, flags from earlier episodes, and the items the player can carry. |
| Look & sound | Colours, fonts, corner roundness, colour grade, and UI sounds. |
| Play | Plays your latest changes like a player would, with the 🐞 debug panel. Start from any scene. |
| Publish | Check for problems, publish a version to staging, make it live, go back to an earlier version, take it down. |

Everything saves by itself a moment after you change it ("All changes saved" at the bottom
left).

**Characters** (top bar) live outside stories, so they can come back in sequels and
spin-offs: name, colour, bio, and per *look* (outfit, age) a portrait for each expression
and optionally full-body art for standing in scenes.

**Series** groups episodes; a spin-off is its own series whose first story carries on from
a story of another series.

## Art

- Drop in PNG or JPG from your image tool (AI art is fine): the Studio converts it to WebP
  and scales it to fit 1080 × 1920 before uploading, so it's small and fast for players.
- Backgrounds: portrait 9:16, ideally 1080 × 1920. The Studio warns when a picture isn't.
- Portraits: every expression of a character the same size and framing.
- Full-body art: feet at the bottom edge, transparent background (PNG or WebP).

## Publishing

1. **Publish to staging.** It's built in your browser, checked, and uploaded as a version
   that never changes. Check it on the player app with `?channel=staging`.
2. **Make it live.** The same version goes in front of everyone.

To change a published story, edit it and publish a new version (the Publish tab suggests the
next number). Players in the middle of the old version keep playing it.

## Working locally

`pnpm --filter @storygames/studio dev` runs the Studio at http://localhost:5174 with no
sign-in, saving to `.storage/` at the repository root (the same folder
`storygames publish --store .storage` and the player's published mode use).
`pnpm --filter @storygames/studio test:e2e` writes a story from scratch, plays it and
publishes it in a real browser.

## The CLI still works

Drafts are laid out exactly like story folders in the repo (`story.json`, `scenes/`,
`narrative/dialogue.json`…), and the CLI builds visual dialogue (`narrative/dialogue.json`)
as well as hand-written ink. Stories copied from the repo keep their ink script; the
Dialogue tab shows it as a script you can edit.
