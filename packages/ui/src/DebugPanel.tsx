import { useState, useSyncExternalStore } from "react";
import type { StorySession } from "@storygames/engine";

/**
 * Author tools for testing a story: jump to scenes, change flags and items, skip
 * dialogue and puzzles. Only shown in development or with `?debug` in the URL.
 */
export function DebugPanel({ session, onRestart }: { session: StorySession; onRestart: () => void }) {
  const [open, setOpen] = useState(false);
  const view = useSyncExternalStore((cb) => session.subscribe(cb), () => session.view());
  const { pack } = session;
  const { flags, inventory, solved, scene } = view.state;

  return (
    <>
      <button
        type="button"
        className="sg-debug-toggle"
        aria-label={open ? "Close debug panel" : "Open debug panel"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "✕" : "🐞"}
      </button>
      {open && (
        <aside className="sg-debug" aria-label="Debug panel">
          <h2>Debug</h2>

          <section>
            <h3>Scene</h3>
            <div className="sg-debug-scenes">
              {pack.scenes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === scene}
                  onClick={() => session.debug.goto(s.id)}
                >
                  {s.title ?? s.id}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Right now</h3>
            <p className="sg-debug-status">
              {view.completed ? "Story complete" : view.puzzle ? `Puzzle: ${view.puzzle.puzzle.id}` : view.dialogue ? "In dialogue" : "Exploring"}
            </p>
            <div className="sg-debug-row">
              <button type="button" disabled={!view.dialogue} onClick={() => session.debug.skipDialogue()}>Skip dialogue</button>
              <button type="button" disabled={!view.puzzle} onClick={() => session.debug.solve()}>Solve puzzle</button>
            </div>
          </section>

          <section>
            <h3>Flags</h3>
            {Object.keys(flags).length === 0 && <p className="sg-debug-empty">No flags</p>}
            {Object.entries(flags).map(([name, value]) => (
              <label key={name} className="sg-debug-field">
                <span>{name}</span>
                {typeof value === "boolean" ? (
                  <input type="checkbox" checked={value} onChange={(e) => session.debug.setFlag(name, e.target.checked)} />
                ) : (
                  <input
                    type={typeof value === "number" ? "number" : "text"}
                    value={String(value)}
                    onChange={(e) => session.debug.setFlag(name, typeof value === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </label>
            ))}
          </section>

          {pack.items.length > 0 && (
            <section>
              <h3>Items</h3>
              {pack.items.map((item) => (
                <label key={item.id} className="sg-debug-field">
                  <span>{item.name}</span>
                  <input
                    type="checkbox"
                    checked={inventory.includes(item.id)}
                    onChange={(e) => (e.target.checked ? session.debug.give(item.id) : session.debug.take(item.id))}
                  />
                </label>
              ))}
            </section>
          )}

          {pack.puzzles.length > 0 && (
            <section>
              <h3>Puzzles solved</h3>
              {pack.puzzles.map((p) => (
                <label key={p.id} className="sg-debug-field">
                  <span>{p.title ?? p.id}</span>
                  <input
                    type="checkbox"
                    checked={solved.includes(p.id)}
                    disabled={solved.includes(p.id)}
                    onChange={() => session.debug.solve(p.id)}
                  />
                </label>
              ))}
            </section>
          )}

          <section className="sg-debug-row">
            <button type="button" onClick={onRestart}>Restart story</button>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(session.save(), null, 2))}>
              Copy save
            </button>
          </section>
        </aside>
      )}
    </>
  );
}
