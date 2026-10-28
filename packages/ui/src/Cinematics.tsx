import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CANVAS, type Camera, type StagePosition } from "@storygames/pack-spec";
import type { Cue, SessionView, StageCharacter, StorySession } from "@storygames/engine";

export function prefersReducedMotion() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How long the screen spends on a cue. Reduced motion keeps only the pauses meant for reading. */
export function cueMs(cue: Cue, reduced = prefersReducedMotion()): number {
  const ms = cue.kind === "transition" ? (cue.transition.type === "none" ? 0 : cue.transition.ms) : cue.ms;
  if (!reduced) return ms;
  return cue.kind === "title" || cue.kind === "wait" ? ms : 0;
}

/** Plays each cue for its length, then hands control back to the story. */
export function useCuePlayer(session: StorySession, cue: Cue | null) {
  useEffect(() => {
    if (!cue) return;
    const done = () => {
      if (session.view().cue === cue) session.cueDone();
    };
    const t = setTimeout(done, cueMs(cue));
    return () => clearTimeout(t);
  }, [session, cue]);
}

/** The `--sg-cue-ms` and data attributes the stylesheet animates scene transitions with. */
export function sceneMotion(cue: Cue | null): { style: CSSProperties; attrs: Record<string, string> } {
  if (!cue) return { style: {}, attrs: {} };
  const style = { "--sg-cue-ms": `${cueMs(cue)}ms` } as CSSProperties;
  if (cue.kind === "transition") return { style, attrs: { "data-transition": cue.transition.type, "data-phase": cue.phase } };
  if (cue.kind === "effect" && cue.effect === "shake") return { style, attrs: { "data-effect": "shake" } };
  return { style, attrs: {} };
}

/**
 * Camera framing: zoom in on a point of the 1080×1920 scene. The point is kept far enough
 * from the edges that the view never shows past the background.
 */
export function cameraStyle(cam: Camera, ms: number): CSSProperties {
  const z = Math.max(1, cam.zoom);
  const half = 0.5 / z;
  const fx = Math.min(1 - half, Math.max(half, cam.x / CANVAS.width));
  const fy = Math.min(1 - half, Math.max(half, cam.y / CANVAS.height));
  if (z === 1) return { transition: `transform ${ms}ms ease-in-out` };
  return {
    transformOrigin: "0 0",
    transform: `translate(${(0.5 - fx * z) * 100}%, ${(0.5 - fy * z) * 100}%) scale(${z})`,
    transition: `transform ${prefersReducedMotion() ? 0 : ms}ms ease-in-out`,
  };
}

const SPOTS: Record<StagePosition, number> = { "far-left": 15, left: 28, center: 50, right: 72, "far-right": 85 };

/** Characters standing in the scene, in front of the background. */
export function Cast({
  view,
  assetUrl,
}: {
  view: SessionView;
  assetUrl: (path: string) => string;
}) {
  const speaker = view.dialogue?.speaker?.id;
  const speakerOnStage = view.stage.some((c) => c.character === speaker && !c.leaving);
  const ms = view.cue?.kind === "stage" ? cueMs(view.cue) : 500;
  return (
    <div className="sg-cast" aria-hidden="true" style={{ "--sg-actor-ms": `${ms}ms` } as CSSProperties}>
      {view.stage.map((c) => {
        const expression = c.character === speaker && view.dialogue?.expression ? view.dialogue.expression : c.expression;
        return (
          <Actor
            key={c.character}
            actor={c}
            expression={expression}
            dim={speakerOnStage && c.character !== speaker}
            assetUrl={assetUrl}
          />
        );
      })}
    </div>
  );
}

function Actor({
  actor,
  expression,
  dim,
  assetUrl,
}: {
  actor: StageCharacter;
  expression: string;
  dim: boolean;
  assetUrl: (path: string) => string;
}) {
  const { sprites, portraits, defaultExpression } = actor.snapshot;
  const sprite = sprites[expression] ?? sprites[defaultExpression];
  const image = sprite ?? portraits[expression] ?? portraits[defaultExpression];
  return (
    <div
      className={sprite ? "sg-actor" : "sg-actor sg-actor-bust"}
      data-actor={actor.character}
      data-from={actor.from}
      data-leaving={actor.leaving?.to}
      data-dim={dim || undefined}
      style={{ left: `${SPOTS[actor.at]}%` }}
    >
      {image && <img src={assetUrl(image)} alt="" draggable={false} />}
    </div>
  );
}

/** Title cards, flashes and the black bars of a cutscene. */
export function CueOverlay({ view }: { view: SessionView }) {
  const cue = view.cue;
  const ms = cue ? `${cueMs(cue)}ms` : "0ms";
  const showBars = view.cutscene && !view.puzzle && !view.completed;
  return (
    <>
      <div className="sg-letterbox" data-on={showBars || undefined} aria-hidden="true" />
      {cue?.kind === "transition" && (cue.transition.type === "fade-black" || cue.transition.type === "fade-white") && (
        <div
          className="sg-curtain"
          data-color={cue.transition.type === "fade-white" ? "white" : "black"}
          data-phase={cue.phase}
          style={{ "--sg-cue-ms": ms } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {cue?.kind === "effect" && cue.effect !== "shake" && (
        <div
          key={cueKey(cue)}
          className="sg-flash"
          data-color={cue.effect === "flash" ? "white" : "black"}
          style={{ "--sg-cue-ms": ms } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {cue?.kind === "title" && (
        <div className="sg-title-card" role="status" style={{ "--sg-cue-ms": ms } as CSSProperties}>
          <p className="sg-title-text">{cue.text}</p>
          {cue.subtitle && <p className="sg-title-sub">{cue.subtitle}</p>}
        </div>
      )}
    </>
  );
}

/** A short "your turn" hint when a scene's opening ends and the player can explore. */
export function YourTurn({ view }: { view: SessionView }) {
  const [shown, setShown] = useState(false);
  const was = useRef(view.cutscene);
  useEffect(() => {
    const opened = was.current && !view.cutscene;
    was.current = view.cutscene;
    if (!opened) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 2400);
    return () => clearTimeout(t);
  }, [view.cutscene]);
  const interactive = !view.cutscene && !view.busy && !view.completed && view.hotspots.length > 0;
  if (!shown || !interactive) return null;
  return (
    <p className="sg-your-turn" role="status">
      Tap around to explore
    </p>
  );
}

const cueIds = new WeakMap<Cue, number>();
let nextCueId = 1;
/** A key that changes for every new cue, so back-to-back effects restart their animation. */
function cueKey(cue: Cue): number {
  let id = cueIds.get(cue);
  if (!id) cueIds.set(cue, (id = nextCueId++));
  return id;
}
