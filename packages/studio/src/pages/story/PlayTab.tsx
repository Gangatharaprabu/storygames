import { useCallback, useEffect, useState } from "react";
import { StorySession } from "@storygames/engine";
import { puzzleLogic, puzzleViews } from "@storygames/puzzles";
import { DebugPanel, SoundBoard, StoryPlayer } from "@storygames/ui";
import { buildDraft, previewUrls } from "../../build.ts";
import { Problems } from "../../components/Problems.tsx";
import { useStudio } from "../../state.tsx";
import type { Problem } from "@storygames/pack-spec";
import { useStory } from "./context.tsx";

const sound = new SoundBoard();

type State =
  | { phase: "building" }
  | { phase: "failed"; errors: Problem[]; warnings: Problem[]; message?: string }
  | { phase: "ready"; session: StorySession; urls: Map<string, string>; warnings: Problem[] };

/** Plays the story straight from the drafts, with the debug panel. */
export function PlayTab() {
  const { api, drafts } = useStudio();
  const r = useStory();
  const [state, setState] = useState<State>({ phase: "building" });
  const [startAt, setStartAt] = useState("");
  const [run, setRun] = useState(0);

  const restart = useCallback(() => setRun((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    let urls: Map<string, string> | undefined;
    setState({ phase: "building" });
    (async () => {
      await drafts.flush();
      // A draft: plays even without an ending or a main character yet.
      const d = await buildDraft(api, r.id, { draft: true });
      if (!d.build.ok) return live && setState({ phase: "failed", errors: d.build.errors, warnings: d.build.warnings });
      urls = await previewUrls(d);
      const session = new StorySession(d.build.pack!, { puzzles: puzzleLogic });
      session.start();
      if (startAt) session.debug.goto(startAt);
      if (live) setState({ phase: "ready", session, urls, warnings: d.build.warnings });
    })().catch((e: Error) => live && setState({ phase: "failed", errors: [], warnings: [], message: e.message }));
    return () => {
      live = false;
      urls?.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, r.id, run]);

  return (
    <div className="st-page st-play">
      <header className="st-page-head">
        <h2>Play</h2>
        <div className="st-row">
          <label className="st-inline">
            <span>Start at</span>
            <select value={startAt} onChange={(e) => setStartAt(e.target.value)}>
              <option value="">the beginning</option>
              {r.scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? s.id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="st-button st-primary" onClick={restart}>
            ↻ Play again
          </button>
        </div>
      </header>
      <p className="st-muted">This plays your latest changes, exactly as players will see them. 🐞 opens the debug panel: jump to scenes, set flags, skip puzzles.</p>
      {state.phase === "building" && <p className="st-muted">Building…</p>}
      {state.phase === "failed" && (
        <>
          {state.message && <p className="st-error">{state.message}</p>}
          <Problems errors={state.errors} warnings={state.warnings} />
        </>
      )}
      {state.phase === "ready" && (
        <div className="st-play-layout">
          <div className="st-phone" data-testid="preview">
            <StoryPlayer key={run} session={state.session} assetUrl={(p) => state.urls.get(p) ?? ""} puzzleViews={puzzleViews} sound={sound} ending={<button type="button" className="sg-button sg-primary" onClick={restart}>Play again</button>}>
              <DebugPanel session={state.session} onRestart={restart} />
            </StoryPlayer>
          </div>
          <Problems errors={[]} warnings={state.warnings} />
        </div>
      )}
    </div>
  );
}
