import type { ComponentType } from "react";
import type { ActivePuzzle } from "@storygames/engine";
import { rectStyle } from "./geometry.ts";
import type { PuzzleViewComponentProps } from "./StoryPlayer.tsx";

/** Shows a puzzle either as a themed full screen or as a panel inside the scene. */
export function PuzzleHost({
  active,
  assetUrl,
  views,
  onSubmit,
  onHint,
  onClose,
}: {
  active: ActivePuzzle;
  assetUrl: (path: string) => string;
  views: Record<string, ComponentType<PuzzleViewComponentProps>>;
  onSubmit: (answer: unknown) => boolean;
  onHint: () => void;
  onClose: () => void;
}) {
  const { puzzle, config, hintsShown } = active;
  const View = views[puzzle.type];
  const skin = Object.fromEntries(Object.entries(puzzle.skin).map(([k, v]) => [k, assetUrl(v)]));
  const inline = puzzle.presentation === "inline" && puzzle.rect;
  const { backdrop, ...viewSkin } = skin;

  return (
    <div
      className={inline ? "sg-puzzle sg-puzzle-inline" : "sg-puzzle sg-puzzle-full"}
      style={inline ? inlineStyle(puzzle.rect!) : backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
      role="dialog"
      aria-label={puzzle.title ?? "Puzzle"}
      data-puzzle={puzzle.id}
    >
      <header className="sg-puzzle-header">
        {puzzle.title && <h2>{puzzle.title}</h2>}
        <button type="button" className="sg-icon-button" aria-label="Leave puzzle" onClick={onClose}>✕</button>
      </header>
      {puzzle.prompt && <p className="sg-puzzle-prompt">{puzzle.prompt}</p>}
      <div className="sg-puzzle-body">
        {View ? <View config={config} skin={viewSkin} onSubmit={onSubmit} /> : <p>Missing view for “{puzzle.type}”.</p>}
      </div>
      {puzzle.hints.length > 0 && (
        <footer className="sg-puzzle-hints">
          {hintsShown.map((h, i) => <p key={i} className="sg-hint">💡 {h}</p>)}
          {hintsShown.length < puzzle.hints.length && (
            <button type="button" className="sg-button" onClick={onHint}>
              {hintsShown.length === 0 ? "Need a hint?" : "Another hint"}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}

/** Inline panels take their position and width from the story, and grow to fit their content. */
function inlineStyle(rect: { x: number; y: number; w: number; h: number }) {
  const { left, top, width } = rectStyle(rect);
  return { left, top, width };
}
