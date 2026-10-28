import { useState } from "react";
import { puzzleLogic } from "@storygames/puzzles";
import { ActionList } from "../../components/actions.tsx";
import { Choice, FilePicker, LongText, Num, Text } from "../../components/fields.tsx";
import { slug, uniqueId, type PuzzleJson } from "../../drafts.ts";
import { go, href } from "../../router.ts";
import { useDraft, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PuzzlesTab({ selected }: { selected?: string }) {
  const { api } = useStudio();
  const r = useStory();
  const current = selected ?? r.puzzles[0]?.id;

  const add = async () => {
    const name = prompt("Name of the puzzle (e.g. “The ferry lock”)");
    if (!name?.trim()) return;
    const id = uniqueId(slug(name), r.puzzles.map((p) => p.id));
    const puzzle: PuzzleJson = {
      id,
      type: "combination-lock",
      presentation: "fullscreen",
      title: name.trim(),
      prompt: "",
      config: { dials: 3, solution: ["1", "2", "3"] },
      hints: [],
      onSolve: [],
    };
    await api.putJson(`${r.root}puzzles/${id}.json`, puzzle);
    r.reload();
    go("story", r.id, "puzzles", id);
  };

  return (
    <div className="st-split">
      <aside className="st-list" aria-label="Puzzles">
        <div className="st-list-head">
          <h2>Puzzles</h2>
          <button type="button" className="st-button" onClick={() => void add()}>
            + New puzzle
          </button>
        </div>
        <ul>
          {r.puzzles.map((p) => (
            <li key={p.id}>
              <a href={href("story", r.id, "puzzles", p.id)} aria-current={p.id === current ? "page" : undefined} className="st-list-item">
                <span>
                  {p.title ?? p.id}
                  <span className="st-muted st-small"> {p.presentation === "inline" ? "panel" : "full screen"}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="st-hint st-pad">Open a puzzle from a hotspot (Scenes tab → hotspot → add step → Puzzle).</p>
      </aside>
      {current && r.puzzles.some((p) => p.id === current) ? <PuzzleEditor key={current} id={current} /> : <p className="st-page st-muted">No puzzles yet.</p>}
    </div>
  );
}

function PuzzleEditor({ id }: { id: string }) {
  const { drafts } = useStudio();
  const r = useStory();
  const key = `${r.root}puzzles/${id}.json`;
  const [p, setP] = useDraft<PuzzleJson>(key);
  const [hint, setHint] = useState("");
  if (!p) return null;
  const set = (patch: Partial<PuzzleJson>) => setP({ ...p, ...patch });
  const hints = p.hints ?? [];

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>{p.title ?? p.id}</h2>
        <button
          type="button"
          className="st-button st-danger"
          onClick={async () => {
            if (!confirm(`Delete the puzzle “${p.title ?? p.id}”?`)) return;
            await drafts.remove(key);
            r.reload();
            go("story", r.id, "puzzles");
          }}
        >
          Delete
        </button>
      </header>
      <section className="st-card st-grid-2">
        <div>
          <Text label="Title" value={p.title} onChange={(title) => set({ title })} />
          <LongText label="What the player is told" value={p.prompt} onChange={(prompt) => set({ prompt })} />
          <div className="st-row">
            <Choice label="Kind" value={p.type} options={Object.keys(puzzleLogic).map((t) => [t, t.replace(/-/g, " ")] as [string, string])} onChange={(type) => set({ type })} />
            <Choice
              label="Shown as"
              value={p.presentation ?? "fullscreen"}
              options={[["fullscreen", "Full screen"], ["inline", "Panel over the scene"]]}
              onChange={(presentation) => set({ presentation, rect: presentation === "inline" ? (p.rect ?? { x: 140, y: 560, w: 800, h: 900 }) : undefined })}
            />
          </div>
        </div>
        <FilePicker label="Puzzle art (lock body)" root={r.root} folder="art/" name={`${p.id}-body`} value={p.skin?.body} onChange={(body) => set({ skin: { ...p.skin, ...(body ? { body } : {}) } })} clearable hint="Optional: drawn behind the dials." />
      </section>

      {p.type === "combination-lock" ? <LockConfig puzzle={p} onChange={(config) => set({ config })} /> : (
        <section className="st-card">
          <h3>Settings (JSON)</h3>
          <textarea className="st-code" rows={6} defaultValue={JSON.stringify(p.config, null, 2)} onChange={(e) => { try { set({ config: JSON.parse(e.target.value) }); } catch { /* keep typing */ } }} />
        </section>
      )}

      <section className="st-card">
        <h3>Hints</h3>
        <p className="st-muted">Shown one at a time when the player asks; gentlest first.</p>
        <ol className="st-hints">
          {hints.map((h, i) => (
            <li key={i}>
              <input type="text" aria-label={`Hint ${i + 1}`} value={h} onChange={(e) => set({ hints: hints.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="st-icon" aria-label="Remove hint" onClick={() => set({ hints: hints.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ol>
        <form className="st-row" onSubmit={(e) => { e.preventDefault(); if (hint.trim()) { set({ hints: [...hints, hint.trim()] }); setHint(""); } }}>
          <input type="text" aria-label="New hint" placeholder="Add a hint…" value={hint} onChange={(e) => setHint(e.target.value)} />
          <button className="st-button">Add</button>
        </form>
      </section>

      <section className="st-card">
        <h3>When solved</h3>
        <ActionList actions={p.onSolve ?? []} onChange={(onSolve) => set({ onSolve })} empty="Nothing else happens (the puzzle just closes)." />
      </section>
    </div>
  );
}

interface LockConfigJson {
  dials: number;
  symbols?: string[];
  solution: string[];
}

function LockConfig({ puzzle, onChange }: { puzzle: PuzzleJson; onChange: (c: LockConfigJson) => void }) {
  const c = (puzzle.config ?? { dials: 3, solution: [] }) as LockConfigJson;
  const symbols = c.symbols ?? DIGITS;
  const setDials = (dials: number) => onChange({ ...c, dials, solution: Array.from({ length: dials }, (_, i) => c.solution[i] ?? symbols[0]!) });
  return (
    <section className="st-card">
      <h3>Combination lock</h3>
      <div className="st-row">
        <Num label="Dials" value={c.dials} min={1} max={8} onChange={setDials} />
        <Text
          label="Symbols on each dial"
          value={symbols.join(" ")}
          onChange={(v) => {
            const list = v.split(/[\s,]+/).filter(Boolean);
            onChange({ ...c, symbols: list.join() === DIGITS.join() ? undefined : list });
          }}
          hint="Separated by spaces: digits, letters or words (e.g. ☀ ☾ ★)."
        />
      </div>
      <div className="st-field">
        <span className="st-label">Solution</span>
        <span className="st-row">
          {Array.from({ length: c.dials }, (_, i) => (
            <select key={i} aria-label={`Dial ${i + 1}`} value={c.solution[i] ?? ""} onChange={(e) => onChange({ ...c, solution: Array.from({ length: c.dials }, (_, j) => (j === i ? e.target.value : (c.solution[j] ?? symbols[0]!))) })}>
              {symbols.map((s) => <option key={s}>{s}</option>)}
            </select>
          ))}
        </span>
      </div>
    </section>
  );
}
