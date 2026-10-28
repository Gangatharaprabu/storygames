import { useEffect, useState } from "react";
import type { DialogueLine } from "@storygames/engine";

/** Characters per second for the typewriter effect. */
const CPS = 45;

function prefersReducedMotion() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Reveals `text` over time, starting again whenever `token` (the line) changes.
 * `complete()` shows it all at once. Progress is tied to the token, so a new line
 * never flashes with the previous line's progress, and a completed line stays complete.
 */
function useTypewriter(text: string, token: unknown) {
  const reduced = prefersReducedMotion();
  const [progress, setProgress] = useState({ token, n: reduced ? text.length : 0 });
  const shown = progress.token === token ? progress.n : reduced ? text.length : 0;

  useEffect(() => {
    if (reduced) {
      setProgress({ token, n: text.length });
      return;
    }
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const n = Math.min(text.length, Math.floor(((now - started) / 1000) * CPS));
      setProgress((p) => (p.token === token ? { token, n: Math.max(p.n, n) } : { token, n }));
      if (n < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, token, reduced]);

  return { shown, done: shown >= text.length, complete: () => setProgress({ token, n: text.length }) };
}

export function DialogueBox({
  line,
  assetUrl,
  onStage = false,
  onAdvance,
  onChoose,
}: {
  line: DialogueLine;
  assetUrl: (path: string) => string;
  /** The speaker is standing in the scene, so no close-up portrait is needed. */
  onStage?: boolean;
  onAdvance: () => void;
  onChoose: (index: number) => void;
}) {
  const portrait = !onStage && line.speaker && line.expression ? line.speaker.portraits[line.expression] : undefined;
  const typing = useTypewriter(line.text, line);

  /** First tap finishes the line, the next one moves on. */
  const next = () => {
    if (!typing.done) typing.complete();
    else if (!line.choices) onAdvance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if ((e.target as HTMLElement | null)?.closest?.("button")) return;
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="sg-dialogue" role="dialog" aria-live="polite">
      {portrait && (
        <img
          key={line.speaker!.id}
          className="sg-portrait"
          src={assetUrl(portrait)}
          alt={`${line.speaker!.name} (${line.expression})`}
        />
      )}
      <div className="sg-dialogue-box" onClick={next} data-testid="dialogue">
        {line.speaker && (
          <p className="sg-speaker" style={{ color: line.speaker.color }}>{line.speaker.name}</p>
        )}
        {/* The whole line is always in the DOM (stable layout, screen readers); the rest is just invisible. */}
        <p className={line.speaker ? "sg-line" : "sg-line sg-narration"}>
          {line.text.slice(0, typing.shown)}
          <span className="sg-untyped">{line.text.slice(typing.shown)}</span>
        </p>
        {line.choices && typing.done ? (
          <ol className="sg-choices">
            {line.choices.map((c, i) => (
              <li key={i}>
                <button type="button" className="sg-button" onClick={(e) => { e.stopPropagation(); onChoose(i); }}>{c}</button>
              </li>
            ))}
          </ol>
        ) : (
          <button type="button" className="sg-continue" aria-label="Continue" onClick={(e) => { e.stopPropagation(); next(); }}>
            <span aria-hidden="true">▾</span>
          </button>
        )}
      </div>
    </div>
  );
}
