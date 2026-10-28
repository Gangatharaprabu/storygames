import { useEffect, useRef, useState } from "react";
import type { Conversation, DialogueFile, DialogueStep } from "@storygames/builder";
import { parseValue, Pick } from "../../components/conditions.tsx";
import { Thumb } from "../../components/fields.tsx";
import { characterRoot, uniqueId } from "../../drafts.ts";
import { go, href } from "../../router.ts";
import { useAsync, useDraft, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

const SCRIPT = "~script";

export function DialogueTab({ selected }: { selected?: string }) {
  const { api } = useStudio();
  const r = useStory();
  const key = `${r.root}narrative/dialogue.json`;
  const [file, setFile] = useDraft<DialogueFile>(key);
  const dialogue = file ?? { conversations: [] };
  const conversations = dialogue.conversations;
  const scripts = useAsync(() => api.list(`${r.root}narrative/`).then((k) => k.filter((x) => x.endsWith(".ink"))), [r.root]);
  const firstScript = scripts.data?.[0]?.split("/").pop();
  const current = selected ?? conversations[0]?.id ?? (firstScript && `${SCRIPT}:${firstScript}`);
  const conv = conversations.find((c) => c.id === current);

  const save = (next: Conversation[]) => setFile({ conversations: next });
  const add = () => {
    const name = prompt("Name of the conversation (e.g. “Meeting Tomo”)");
    if (!name?.trim()) return;
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "c$1") || "talk";
    const id = uniqueId(base, [...conversations.map((c) => c.id), ...r.inkKnots], "_");
    save([...conversations, { id, title: name.trim(), steps: [{ type: "line", text: "…" }] }]);
    go("story", r.id, "dialogue", id);
  };

  return (
    <div className="st-split">
      <aside className="st-list" aria-label="Conversations">
        <div className="st-list-head">
          <h2>Dialogue</h2>
          <button type="button" className="st-button" onClick={add}>
            + New conversation
          </button>
        </div>
        <ul>
          {conversations.map((c) => (
            <li key={c.id}>
              <a href={href("story", r.id, "dialogue", c.id)} aria-current={c.id === current ? "page" : undefined} className="st-list-item">
                <span>
                  {c.title ?? c.id}
                  <span className="st-muted st-small"> {c.id}</span>
                </span>
              </a>
            </li>
          ))}
          {(scripts.data ?? []).map((k) => (
            <li key={k}>
              <a href={href("story", r.id, "dialogue", `${SCRIPT}:${k.split("/").pop()}`)} aria-current={current === `${SCRIPT}:${k.split("/").pop()}` ? "page" : undefined} className="st-list-item">
                <span>
                  Script: {k.split("/").pop()}
                  <span className="st-muted st-small"> ink</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="st-hint st-pad">Start conversations from a scene's opening or a hotspot (Scenes tab).</p>
      </aside>
      {current?.startsWith(`${SCRIPT}:`) ? (
        <ScriptEditor key={current} file={`${r.root}narrative/${current.slice(SCRIPT.length + 1)}`} />
      ) : conv ? (
        <div className="st-page">
          <header className="st-page-head">
            <input className="st-title-input" aria-label="Conversation name" value={conv.title ?? ""} placeholder={conv.id} onChange={(e) => save(conversations.map((c) => (c === conv ? { ...c, title: e.target.value } : c)))} />
            <button
              type="button"
              className="st-button st-danger"
              onClick={() => {
                if (!confirm(`Delete the conversation “${conv.title ?? conv.id}”?`)) return;
                save(conversations.filter((c) => c !== conv));
                go("story", r.id, "dialogue");
              }}
            >
              Delete
            </button>
          </header>
          <p className="st-muted">
            Id <code>{conv.id}</code>. Lines play one by one; choices let the player pick; conditions check what happened earlier.
          </p>
          <StepList steps={conv.steps} onChange={(steps) => save(conversations.map((c) => (c === conv ? { ...c, steps } : c)))} />
        </div>
      ) : (
        <p className="st-page st-muted">No conversations yet.</p>
      )}
    </div>
  );
}

function StepList({ steps, onChange, depth = 0 }: { steps: DialogueStep[]; onChange: (s: DialogueStep[]) => void; depth?: number }) {
  const r = useStory();
  const lastSpeaker = [...steps].reverse().find((s): s is Extract<DialogueStep, { type: "line" }> => s.type === "line" && Boolean(s.speaker))?.speaker;
  const set = (i: number, s: DialogueStep) => onChange(steps.map((x, j) => (j === i ? s : x)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s!);
    onChange(next);
  };
  const flags = Object.keys(r.story.flags ?? {});
  const items = (r.story.items ?? []).map((i) => i.id);
  const add = (type: string) => {
    const s: DialogueStep | undefined =
      type === "line" ? { type: "line", speaker: lastSpeaker ?? r.cast[0]?.character.id, text: "" }
      : type === "narration" ? { type: "line", text: "" }
      : type === "choice" ? { type: "choice", options: [{ text: "Yes", steps: [] }, { text: "No", steps: [] }] }
      : type === "set" ? { type: "set", flag: flags[0] ?? "", value: true }
      : type === "give" || type === "take" ? { type, item: items[0] ?? "" }
      : type === "if" ? { type: "if", flag: flags[0] ?? "", equals: true, then: [], else: [] }
      : type === "goto" ? { type: "goto", conversation: r.dialogue.conversations[0]?.id ?? "" }
      : undefined;
    if (s) onChange([...steps, s]);
  };

  return (
    <div className="st-steps" data-depth={depth}>
      {steps.map((s, i) => (
        <div key={i} className={`st-step st-step-${s.type}`}>
          <div className="st-step-body">
            <StepFields step={s} onChange={(x) => set(i, x)} depth={depth} />
          </div>
          <span className="st-action-tools">
            <button type="button" className="st-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="st-icon" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="st-icon" aria-label="Delete line" onClick={() => onChange(steps.filter((_, j) => j !== i))}>×</button>
          </span>
        </div>
      ))}
      <div className="st-step-add">
        <button type="button" className="st-button" onClick={() => add("line")}>+ Line</button>
        <button type="button" className="st-button" onClick={() => add("narration")}>+ Narration</button>
        <button type="button" className="st-button" onClick={() => add("choice")}>+ Choice</button>
        <select value="" aria-label="More" onChange={(e) => add(e.target.value)}>
          <option value="">More…</option>
          <option value="if">If… (condition)</option>
          <option value="set">Set a flag</option>
          <option value="give">Give an item</option>
          <option value="take">Take an item</option>
          <option value="goto">Jump to another conversation</option>
        </select>
      </div>
    </div>
  );
}

function StepFields({ step: s, onChange, depth }: { step: DialogueStep; onChange: (s: DialogueStep) => void; depth: number }) {
  const r = useStory();
  switch (s.type) {
    case "line": {
      const member = r.cast.find((c) => c.character.id === s.speaker);
      const portraits = member?.character.variants[member.variant]?.portraits;
      const expr = s.expression ?? member?.character.variants[member.variant]?.defaultExpression;
      return (
        <div className="st-line">
          <div className="st-line-who">
            {member && <Thumb fileKey={portraits && expr && portraits[expr] ? characterRoot(member.character.id) + portraits[expr] : undefined} className="st-avatar" />}
            <select aria-label="Speaker" value={s.speaker ?? ""} onChange={(e) => onChange({ ...s, speaker: e.target.value || undefined, expression: undefined })}>
              <option value="">Narration</option>
              {r.cast.map((c) => (
                <option key={c.character.id} value={c.character.id}>
                  {c.character.name}
                </option>
              ))}
            </select>
            {member && (
              <select aria-label="Expression" value={s.expression ?? ""} onChange={(e) => onChange({ ...s, expression: e.target.value || undefined })}>
                <option value="">(as before)</option>
                {member.expressions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            )}
          </div>
          <textarea
            className={s.speaker ? "st-line-text" : "st-line-text st-narration"}
            aria-label="Line"
            rows={2}
            value={s.text}
            placeholder={s.speaker ? "What they say…" : "What happens…"}
            onChange={(e) => onChange({ ...s, text: e.target.value })}
          />
        </div>
      );
    }
    case "choice":
      return (
        <div className="st-choice">
          <span className="st-step-kind">The player chooses</span>
          {s.options.map((o, n) => (
            <div key={n} className="st-option">
              <div className="st-option-head">
                <span>→</span>
                <input type="text" aria-label="Choice" value={o.text} onChange={(e) => onChange({ ...s, options: s.options.map((x, k) => (k === n ? { ...x, text: e.target.value } : x)) })} />
                <button type="button" className="st-icon" aria-label="Remove choice" disabled={s.options.length < 2} onClick={() => onChange({ ...s, options: s.options.filter((_, k) => k !== n) })}>×</button>
              </div>
              <StepList depth={depth + 1} steps={o.steps} onChange={(steps) => onChange({ ...s, options: s.options.map((x, k) => (k === n ? { ...x, steps } : x)) })} />
            </div>
          ))}
          <button type="button" className="st-link" onClick={() => onChange({ ...s, options: [...s.options, { text: "Another option", steps: [] }] })}>
            + another choice
          </button>
          <p className="st-hint">After any choice, the conversation carries on below.</p>
        </div>
      );
    case "if":
      return (
        <div className="st-choice">
          <span className="st-step-kind">
            If{" "}
            <Pick value={s.flag} options={Object.keys(r.story.flags ?? {})} onChange={(flag) => onChange({ ...s, flag })} empty="(add flags first)" label="Flag" /> is{" "}
            <input type="text" className="st-short" aria-label="Value" value={String(s.equals)} onChange={(e) => onChange({ ...s, equals: parseValue(e.target.value) })} />
          </span>
          <div className="st-option">
            <div className="st-option-head"><span>then</span></div>
            <StepList depth={depth + 1} steps={s.then} onChange={(then) => onChange({ ...s, then })} />
          </div>
          <div className="st-option">
            <div className="st-option-head"><span>otherwise</span></div>
            <StepList depth={depth + 1} steps={s.else} onChange={(otherwise) => onChange({ ...s, else: otherwise })} />
          </div>
        </div>
      );
    case "set":
      return (
        <span className="st-step-kind">
          Set flag <Pick value={s.flag} options={Object.keys(r.story.flags ?? {})} onChange={(flag) => onChange({ ...s, flag })} empty="(add flags under Flags & items)" label="Flag" /> to{" "}
          <input type="text" className="st-short" aria-label="Value" value={String(s.value)} onChange={(e) => onChange({ ...s, value: parseValue(e.target.value) })} />
        </span>
      );
    case "give":
    case "take":
      return (
        <span className="st-step-kind">
          {s.type === "give" ? "Player gets" : "Player gives up"}{" "}
          <Pick value={s.item} options={(r.story.items ?? []).map((i) => i.id)} onChange={(item) => onChange({ ...s, item })} empty="(add items under Flags & items)" label="Item" />
          <span className="st-hint"> (with the line before it)</span>
        </span>
      );
    case "goto":
      return (
        <span className="st-step-kind">
          Continue with <Pick value={s.conversation} options={r.dialogue.conversations.map((c) => c.id)} onChange={(conversation) => onChange({ ...s, conversation })} label="Conversation" />
        </span>
      );
  }
}

/** Hand-written ink (stories imported from the repo). */
function ScriptEditor({ file }: { file: string }) {
  const { api } = useStudio();
  const [text, setText] = useState<string>();
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    void api.text(file).then((t) => setText(t ?? ""));
  }, [api, file]);
  if (text === undefined) return <p className="st-page st-muted">Loading…</p>;
  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>{file.split("/").pop()}</h2>
        <span className="st-muted">{status}</span>
      </header>
      <p className="st-muted">
        This story's dialogue is written in <a href="https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md" target="_blank" rel="noreferrer">ink</a>. Lines like <code>tomo: Hello. #happy</code> are spoken by a character.
      </p>
      <textarea
        className="st-code st-script"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus("Saving…");
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => {
            api.put(file, value).then(() => setStatus("Saved"), (err: Error) => setStatus(`Not saved: ${err.message}`));
          }, 700);
        }}
      />
    </div>
  );
}
