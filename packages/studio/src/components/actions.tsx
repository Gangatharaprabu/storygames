import type { Action } from "@storygames/pack-spec";
import { STAGE_POSITIONS, TRANSITIONS } from "@storygames/pack-spec";
import type { z } from "zod";
import { knotsOf, useStory } from "../pages/story/context.tsx";
import { ConditionEditor, parseValue, Pick } from "./conditions.tsx";

export type ActionJson = z.input<typeof Action>;
type Do = ActionJson["do"];

const GROUPS: Array<[string, Array<[Do, string]>]> = [
  ["Story", [["dialogue", "Conversation"], ["puzzle", "Puzzle"], ["goto", "Go to scene"], ["end", "End the story"]]],
  ["State", [["set", "Set a flag"], ["give", "Give an item"], ["take", "Take an item"]]],
  [
    "Cinematic",
    [
      ["title", "Title card"],
      ["camera", "Camera move"],
      ["enter", "Character walks in"],
      ["move", "Character moves"],
      ["expression", "Change expression"],
      ["exit", "Character leaves"],
      ["effect", "Screen effect"],
      ["wait", "Pause"],
    ],
  ],
];
const LABEL = new Map(GROUPS.flatMap(([, list]) => list));

/** One line describing an action, for the collapsed list. */
function summary(a: ActionJson): string {
  switch (a.do) {
    case "dialogue":
      return `Conversation “${a.knot}”`;
    case "puzzle":
      return `Puzzle “${a.puzzle}”`;
    case "goto":
      return `Go to “${a.scene}”${a.transition ? ` (${a.transition.type})` : ""}`;
    case "end":
      return "The end";
    case "set":
      return `Set ${a.flag} = ${String(a.value ?? true)}`;
    case "give":
      return `Give ${a.item}`;
    case "take":
      return `Take ${a.item}`;
    case "title":
      return `Title “${a.text}”`;
    case "camera":
      return `Camera → ${a.zoom ?? "same"}× at ${a.x ?? "·"}, ${a.y ?? "·"}`;
    case "enter":
      return `${a.character} walks in (${a.at ?? "center"})`;
    case "move":
      return `${a.character} moves to ${a.to}`;
    case "expression":
      return `${a.character} looks ${a.expression}`;
    case "exit":
      return `${a.character} leaves`;
    case "effect":
      return `Effect: ${a.effect}`;
    case "wait":
      return `Pause ${a.ms ?? 800} ms`;
  }
}

function blank(kind: Do, r: ReturnType<typeof useStory>): ActionJson {
  const char = r.cast[0]?.character.id ?? "";
  switch (kind) {
    case "dialogue":
      return { do: "dialogue", knot: knotsOf(r)[0] ?? "" };
    case "puzzle":
      return { do: "puzzle", puzzle: r.puzzles[0]?.id ?? "" };
    case "goto":
      return { do: "goto", scene: r.scenes[0]?.id ?? "" };
    case "end":
      return { do: "end" };
    case "set":
      return { do: "set", flag: Object.keys(r.story.flags ?? {})[0] ?? "", value: true };
    case "give":
    case "take":
      return { do: kind, item: r.story.items?.[0]?.id ?? "" };
    case "title":
      return { do: "title", text: r.story.title, ms: 2200 };
    case "camera":
      return { do: "camera", x: 540, y: 960, zoom: 1.5, ms: 1200 };
    case "enter":
      return { do: "enter", character: char, at: "center", from: "left", ms: 600 };
    case "move":
      return { do: "move", character: char, to: "right", ms: 500 };
    case "expression":
      return { do: "expression", character: char, expression: r.cast[0]?.expressions[0] ?? "neutral" };
    case "exit":
      return { do: "exit", character: char, to: "right", ms: 500 };
    case "effect":
      return { do: "effect", effect: "shake", ms: 450 };
    case "wait":
      return { do: "wait", ms: 800 };
  }
}

/** A list of things that happen, in order. */
export function ActionList({ actions, onChange, empty = "Nothing happens yet." }: { actions: ActionJson[]; onChange: (a: ActionJson[]) => void; empty?: string }) {
  const story = useStory();
  const set = (i: number, a: ActionJson) => onChange(actions.map((x, j) => (j === i ? a : x)));
  const move = (i: number, by: number) => {
    const next = [...actions];
    const [a] = next.splice(i, 1);
    next.splice(i + by, 0, a!);
    onChange(next);
  };
  return (
    <div className="st-actions">
      {!actions.length && <p className="st-muted">{empty}</p>}
      <ol>
        {actions.map((a, i) => (
          <li key={i} className="st-action">
            <details>
              <summary>
                <span className="st-action-kind">{LABEL.get(a.do)}</span>
                <span className="st-action-text">{summary(a)}</span>
                {a.if && <span className="st-badge">conditional</span>}
              </summary>
              <div className="st-action-body">
                <ActionFields action={a} onChange={(x) => set(i, x)} />
                <ConditionEditor value={a.if} onChange={(c) => set(i, { ...a, if: c })} />
              </div>
            </details>
            <span className="st-action-tools">
              <button type="button" className="st-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" className="st-icon" aria-label="Move down" disabled={i === actions.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
              <button type="button" className="st-icon" aria-label="Delete step" onClick={() => onChange(actions.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
      <select
        className="st-add"
        value=""
        aria-label="Add a step"
        onChange={(e) => {
          if (e.target.value) onChange([...actions, blank(e.target.value as Do, story)]);
        }}
      >
        <option value="">+ Add a step…</option>
        {GROUPS.map(([group, list]) => (
          <optgroup key={group} label={group}>
            {list.map(([kind, text]) => (
              <option key={kind} value={kind}>
                {text}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

const num = (v: string) => (v === "" ? undefined : Number(v));

function ActionFields({ action: a, onChange }: { action: ActionJson; onChange: (a: ActionJson) => void }) {
  const r = useStory();
  const chars = r.cast.map((c) => c.character.id);
  const expressionsOf = (id: string) => r.cast.find((c) => c.character.id === id)?.expressions ?? [];
  const msField = (dflt: number) =>
    "ms" in a || ["wait", "camera", "enter", "move", "exit", "title", "effect"].includes(a.do) ? (
      <label className="st-inline">
        <span>Duration (ms)</span>
        <input type="number" min={0} max={10000} step={100} value={(a as { ms?: number }).ms ?? dflt} onChange={(e) => onChange({ ...a, ms: num(e.target.value) } as ActionJson)} />
      </label>
    ) : null;
  const waitField =
    a.do === "camera" || a.do === "enter" || a.do === "move" || a.do === "exit" ? (
      <label className="st-check">
        <input type="checkbox" checked={a.wait !== false} onChange={(e) => onChange({ ...a, wait: e.target.checked })} />
        <span>Wait for it to finish</span>
      </label>
    ) : null;
  const charField = (value: string, set: (c: string) => void) => (
    <label className="st-inline">
      <span>Character</span>
      <Pick value={value} options={chars} onChange={set} empty="add characters to the cast first (Overview)" />
    </label>
  );

  switch (a.do) {
    case "dialogue":
      return (
        <label className="st-inline">
          <span>Conversation</span>
          <Pick value={a.knot} options={knotsOf(r)} onChange={(knot) => onChange({ ...a, knot })} empty="no conversations yet (Dialogue tab)" />
        </label>
      );
    case "puzzle":
      return (
        <label className="st-inline">
          <span>Puzzle</span>
          <Pick value={a.puzzle} options={r.puzzles.map((p) => p.id)} onChange={(puzzle) => onChange({ ...a, puzzle })} empty="no puzzles yet (Puzzles tab)" />
        </label>
      );
    case "goto":
      return (
        <>
          <label className="st-inline">
            <span>Scene</span>
            <Pick value={a.scene} options={r.scenes.map((s) => s.id)} onChange={(scene) => onChange({ ...a, scene })} />
          </label>
          <label className="st-inline">
            <span>Transition</span>
            <select value={a.transition?.type ?? ""} onChange={(e) => onChange({ ...a, transition: e.target.value ? { type: e.target.value as (typeof TRANSITIONS)[number], ms: a.transition?.ms ?? 700 } : undefined })}>
              <option value="">The scenes' own</option>
              {TRANSITIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </>
      );
    case "end":
      return <p className="st-muted">The scene leaves, then the ending screen appears.</p>;
    case "set":
      return (
        <>
          <label className="st-inline">
            <span>Flag</span>
            <Pick value={a.flag} options={Object.keys(r.story.flags ?? {})} onChange={(flag) => onChange({ ...a, flag })} empty="no flags yet (Flags & items tab)" />
          </label>
          <label className="st-inline">
            <span>Value</span>
            <input type="text" value={String(a.value ?? true)} onChange={(e) => onChange({ ...a, value: parseValue(e.target.value) })} />
          </label>
        </>
      );
    case "give":
    case "take":
      return (
        <label className="st-inline">
          <span>Item</span>
          <Pick value={a.item} options={(r.story.items ?? []).map((i) => i.id)} onChange={(item) => onChange({ ...a, item })} empty="no items yet (Flags & items tab)" />
        </label>
      );
    case "title":
      return (
        <>
          <label className="st-inline st-grow">
            <span>Title</span>
            <input type="text" value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} />
          </label>
          <label className="st-inline st-grow">
            <span>Subtitle</span>
            <input type="text" value={a.subtitle ?? ""} onChange={(e) => onChange({ ...a, subtitle: e.target.value || undefined })} />
          </label>
          {msField(2200)}
        </>
      );
    case "camera":
      return (
        <>
          <p className="st-muted">Point on the scene (1080 × 1920) to centre on, and zoom (1 = whole scene). The scene picture shows x, y under the pointer.</p>
          <label className="st-inline"><span>x</span><input type="number" min={0} max={1080} value={a.x ?? ""} onChange={(e) => onChange({ ...a, x: num(e.target.value) })} /></label>
          <label className="st-inline"><span>y</span><input type="number" min={0} max={1920} value={a.y ?? ""} onChange={(e) => onChange({ ...a, y: num(e.target.value) })} /></label>
          <label className="st-inline"><span>Zoom</span><input type="number" min={1} max={4} step={0.1} value={a.zoom ?? ""} onChange={(e) => onChange({ ...a, zoom: num(e.target.value) })} /></label>
          {msField(1200)}
          {waitField}
        </>
      );
    case "enter":
      return (
        <>
          {charField(a.character, (character) => onChange({ ...a, character, expression: undefined }))}
          <label className="st-inline">
            <span>Stands at</span>
            <select value={a.at ?? "center"} onChange={(e) => onChange({ ...a, at: e.target.value as (typeof STAGE_POSITIONS)[number] })}>
              {STAGE_POSITIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="st-inline">
            <span>Comes from</span>
            <select value={a.from ?? "fade"} onChange={(e) => onChange({ ...a, from: e.target.value as "left" })}>
              {["left", "right", "bottom", "fade"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="st-inline">
            <span>Expression</span>
            <Pick value={a.expression ?? ""} options={expressionsOf(a.character)} onChange={(expression) => onChange({ ...a, expression })} />
          </label>
          {msField(500)}
          {waitField}
        </>
      );
    case "move":
      return (
        <>
          {charField(a.character, (character) => onChange({ ...a, character }))}
          <label className="st-inline">
            <span>To</span>
            <select value={a.to} onChange={(e) => onChange({ ...a, to: e.target.value as (typeof STAGE_POSITIONS)[number] })}>
              {STAGE_POSITIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {msField(500)}
          {waitField}
        </>
      );
    case "expression":
      return (
        <>
          {charField(a.character, (character) => onChange({ ...a, character }))}
          <label className="st-inline">
            <span>Expression</span>
            <Pick value={a.expression} options={expressionsOf(a.character)} onChange={(expression) => onChange({ ...a, expression })} />
          </label>
        </>
      );
    case "exit":
      return (
        <>
          {charField(a.character, (character) => onChange({ ...a, character }))}
          <label className="st-inline">
            <span>Leaves to</span>
            <select value={a.to ?? "fade"} onChange={(e) => onChange({ ...a, to: e.target.value as "left" })}>
              {["left", "right", "bottom", "fade"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {msField(400)}
          {waitField}
        </>
      );
    case "effect":
      return (
        <>
          <label className="st-inline">
            <span>Effect</span>
            <select value={a.effect} onChange={(e) => onChange({ ...a, effect: e.target.value as "shake" })}>
              {["shake", "flash", "flash-black"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {msField(450)}
        </>
      );
    case "wait":
      return msField(800);
  }
}
