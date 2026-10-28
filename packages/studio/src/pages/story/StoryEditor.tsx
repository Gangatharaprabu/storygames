import { useMemo, useSyncExternalStore } from "react";
import type { DialogueFile } from "@storygames/builder";
import { characterRoot, listCharacters, storyRoot, type CharacterJson, type PuzzleJson, type SceneJson, type StoryJson } from "../../drafts.ts";
import { href } from "../../router.ts";
import { useAsync, useDraft, useSaveStatus, useStudio } from "../../state.tsx";
import { StoryContext, type StoryRefs } from "./context.tsx";
import { DataTab } from "./DataTab.tsx";
import { DialogueTab } from "./DialogueTab.tsx";
import { LookTab } from "./LookTab.tsx";
import { OverviewTab } from "./OverviewTab.tsx";
import { PlayTab } from "./PlayTab.tsx";
import { PublishTab } from "./PublishTab.tsx";
import { PuzzlesTab } from "./PuzzlesTab.tsx";
import { ScenesTab } from "./ScenesTab.tsx";

const TABS: Array<[string, string]> = [
  ["overview", "Overview"],
  ["scenes", "Scenes"],
  ["dialogue", "Dialogue"],
  ["puzzles", "Puzzles"],
  ["data", "Flags & items"],
  ["look", "Look & sound"],
  ["play", "Play"],
  ["publish", "Publish"],
];

export function StoryEditor({ id, tab = "overview", item }: { id: string; tab?: string; item?: string }) {
  const { api, drafts } = useStudio();
  useSyncExternalStore(drafts.subscribe, drafts.snapshot);
  const root = storyRoot(id);
  const [story, setStory, loaded] = useDraft<StoryJson>(`${root}story.json`);
  const files = useAsync(() => api.list(root), [root]);
  const library = useAsync(() => listCharacters(api), []);
  const status = useSaveStatus();

  const keys = files.data ?? [];
  const sceneKeys = keys.filter((k) => /\/scenes\/[^/]+\.json$/.test(k));
  const puzzleKeys = keys.filter((k) => /\/puzzles\/[^/]+\.json$/.test(k));
  const scenes = sceneKeys.map((k) => drafts.get<SceneJson>(k)).filter((s): s is SceneJson => Boolean(s));
  const puzzles = puzzleKeys.map((k) => drafts.get<PuzzleJson>(k)).filter((p): p is PuzzleJson => Boolean(p));
  const dialogue = drafts.get<DialogueFile>(`${root}narrative/dialogue.json`) ?? { conversations: [] };
  const inkFiles = keys.filter((k) => k.startsWith(`${root}narrative/`) && k.endsWith(".ink"));
  const ink = useAsync(async () => (await Promise.all(inkFiles.map((k) => api.text(k)))).join("\n"), [inkFiles.join()]);
  const inkKnots = useMemo(() => [...(ink.data ?? "").matchAll(/^\s*===\s*(\w+)/gm)].map((m) => m[1]!), [ink.data]);

  const cast = (story?.cast ?? []).flatMap((m) => {
    const c = drafts.get<CharacterJson>(`${characterRoot(m.character)}character.json`);
    if (!c) return [];
    const v = c.variants[m.variant ?? "default"] ?? Object.values(c.variants)[0];
    return [{ character: c, variant: m.variant ?? "default", expressions: v ? [...new Set([...Object.keys(v.portraits), ...Object.keys(v.sprites ?? {})])] : [] }];
  });

  if (!loaded) return <p className="st-page st-muted">Loading…</p>;
  if (!story) return <p className="st-page">There's no story “{id}”. <a href={href()}>Back to stories</a></p>;

  const refs: StoryRefs = {
    id,
    root,
    story,
    setStory,
    scenes,
    puzzles,
    dialogue,
    inkKnots,
    cast,
    library: library.data ?? [],
    reload: () => {
      files.reload();
      library.reload();
    },
  };

  return (
    <StoryContext.Provider value={refs}>
      <div className="st-editor">
        <nav className="st-tabs" aria-label="Story">
          <a className="st-back" href={href()}>
            ← Stories
          </a>
          <h1 className="st-story-title">{story.title}</h1>
          <p className="st-story-meta">
            {story.series ? `${story.series.title} · Ep ${story.series.episode} · ` : ""}v{story.version}
          </p>
          {TABS.map(([t, label]) => (
            <a key={t} href={href("story", id, t)} aria-current={t === tab ? "page" : undefined}>
              {label}
            </a>
          ))}
          <p className={`st-save ${status === "saved" ? "" : status === "saving" ? "st-saving" : "st-save-error"}`} role="status">
            {status === "saved" ? "All changes saved" : status === "saving" ? "Saving…" : status}
          </p>
        </nav>
        <main className="st-editor-main">
          {tab === "overview" && <OverviewTab />}
          {tab === "scenes" && <ScenesTab selected={item} />}
          {tab === "dialogue" && <DialogueTab selected={item} />}
          {tab === "puzzles" && <PuzzlesTab selected={item} />}
          {tab === "data" && <DataTab />}
          {tab === "look" && <LookTab />}
          {tab === "play" && <PlayTab />}
          {tab === "publish" && <PublishTab />}
        </main>
      </div>
    </StoryContext.Provider>
  );
}
