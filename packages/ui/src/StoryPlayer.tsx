import { useEffect, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { StorySession } from "@storygames/engine";
import type { SoundBoard } from "./audio.ts";
import { DialogueBox } from "./DialogueBox.tsx";
import { PuzzleHost } from "./PuzzleHost.tsx";
import { RotateNotice } from "./RotateNotice.tsx";
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
  sound?: SoundBoard;
  onRestart?: () => void;
  /** Extra controls drawn over the viewport, e.g. the debug panel. */
  children?: ReactNode;
}

/** Plays one story session in a portrait stage that scales to fit the screen. */
export function StoryPlayer({ session, assetUrl, puzzleViews, sound, onRestart, children }: StoryPlayerProps) {
  const view = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.view(),
  );
  const { theme, manifest } = session.pack;

  const sounds = theme.sounds;
  const music = view.scene.music ? assetUrl(view.scene.music) : undefined;
  useEffect(() => {
    sound?.setMusic(music);
  }, [sound, music]);
  useEffect(() => () => sound?.stop(), [sound]);
  useEffect(
    () =>
      session.onEvent((e) => {
        if (e.type === "puzzle-solved") sound?.play(sounds.solve && assetUrl(sounds.solve));
      }),
    [session, sound, sounds, assetUrl],
  );
  const sfx = (path: string | undefined) => sound?.play(path && assetUrl(path));
  const muted = useSyncExternalStore(
    (cb) => sound?.subscribe(cb) ?? (() => {}),
    () => sound?.muted ?? true,
  );
  const hasAudio = Boolean(sounds.tap || sounds.solve || sounds.wrong || session.pack.scenes.some((s) => s.music));

  return (
    <div className="sg-viewport" style={themeVars(theme, assetUrl)}>
      <div className="sg-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${assetUrl(view.scene.background)})` }} />
      <main className="sg-stage" aria-label={manifest.title}>
        <SceneView
          view={view}
          assetUrl={assetUrl}
          onHotspot={(id) => {
            sfx(sounds.tap);
            session.activateHotspot(id);
          }}
        />

        {sound && hasAudio && (
          <button
            type="button"
            className="sg-icon-button sg-mute"
            aria-label={muted ? "Sound on" : "Sound off"}
            onClick={() => sound.setMuted(!muted)}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}

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
            onSubmit={(a) => {
              const ok = session.submitPuzzle(a);
              if (!ok) sfx(sounds.wrong);
              return ok;
            }}
            onHint={() => session.requestHint()}
            onClose={() => session.closePuzzle()}
          />
        )}

        {view.dialogue && (
          <DialogueBox
            line={view.dialogue}
            assetUrl={assetUrl}
            onAdvance={() => session.advance()}
            onChoose={(i) => {
              sfx(sounds.tap);
              session.choose(i);
            }}
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
      {children}
      <RotateNotice />
    </div>
  );
}
