import { useEffect, useSyncExternalStore, type ComponentType } from "react";
import type { StorySession } from "@storygames/engine";
import { DialogueBox } from "./DialogueBox.tsx";
import { PuzzleHost } from "./PuzzleHost.tsx";
import { SceneView } from "./SceneView.tsx";
import { themeVars } from "./theme.ts";

export interface PuzzleViewComponentProps {
  config: unknown;
  skin: Record<string, string>;
  onSubmit: (answer: unknown) => boolean;
}

export interface StoryPlayerProps {
  session: StorySession;
  /** Resolves a pack-relative asset path to a URL. */
  assetUrl: (path: string) => string;
  puzzleViews: Record<string, ComponentType<PuzzleViewComponentProps>>;
  onRestart?: () => void;
}

/** Plays one story session in a portrait stage that scales to fit the screen. */
export function StoryPlayer({ session, assetUrl, puzzleViews, onRestart }: StoryPlayerProps) {
  const view = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.view(),
  );
  const { theme, manifest } = session.pack;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && view.dialogue && !view.dialogue.choices) {
        e.preventDefault();
        session.advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, view.dialogue]);

  return (
    <div className="sg-viewport" style={themeVars(theme, assetUrl)}>
      <main className="sg-stage" aria-label={manifest.title}>
        <SceneView view={view} assetUrl={assetUrl} onHotspot={(id) => session.activateHotspot(id)} />

        {view.inventory.length > 0 && (
          <ul className="sg-inventory" aria-label="Inventory">
            {view.inventory.map((item) => (
              <li key={item.id} title={item.name}>
                <img src={assetUrl(item.icon)} alt={item.name} />
              </li>
            ))}
          </ul>
        )}

        {view.puzzle && (
          <PuzzleHost
            active={view.puzzle}
            assetUrl={assetUrl}
            views={puzzleViews}
            onSubmit={(a) => session.submitPuzzle(a)}
            onHint={() => session.requestHint()}
            onClose={() => session.closePuzzle()}
          />
        )}

        {view.dialogue && (
          <DialogueBox
            line={view.dialogue}
            assetUrl={assetUrl}
            onAdvance={() => session.advance()}
            onChoose={(i) => session.choose(i)}
          />
        )}

        {view.completed && (
          <div className="sg-end" role="dialog" aria-label="The end">
            <p className="sg-end-kicker">The End</p>
            <h1>{manifest.title}</h1>
            {onRestart && (
              <button type="button" className="sg-button sg-primary" onClick={onRestart}>Play again</button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
