import { useState } from "react";
import type { Condition, FlagValue } from "@storygames/pack-spec";
import { useStory } from "../pages/story/context.tsx";

type Rule =
  | { kind: "flag"; flag: string }
  | { kind: "not-flag"; flag: string }
  | { kind: "flag-is"; flag: string; is: FlagValue }
  | { kind: "has"; item: string }
  | { kind: "lacks"; item: string }
  | { kind: "solved"; puzzle: string }
  | { kind: "unsolved"; puzzle: string };

const KINDS: Array<[Rule["kind"], string]> = [
  ["flag", "flag is on"],
  ["not-flag", "flag is off"],
  ["flag-is", "flag equals"],
  ["has", "player has item"],
  ["lacks", "player doesn't have item"],
  ["solved", "puzzle is solved"],
  ["unsolved", "puzzle isn't solved"],
];

function toRule(c: Condition): Rule | null {
  if ("flag" in c) return c.is === undefined || c.is === true ? { kind: "flag", flag: c.flag } : { kind: "flag-is", flag: c.flag, is: c.is };
  if ("has" in c) return { kind: "has", item: c.has };
  if ("solved" in c) return { kind: "solved", puzzle: c.solved };
  if ("not" in c) {
    const inner = c.not;
    if ("flag" in inner && (inner.is === undefined || inner.is === true)) return { kind: "not-flag", flag: inner.flag };
    if ("has" in inner) return { kind: "lacks", item: inner.has };
    if ("solved" in inner) return { kind: "unsolved", puzzle: inner.solved };
  }
  return null;
}

function fromRule(r: Rule): Condition {
  switch (r.kind) {
    case "flag":
      return { flag: r.flag };
    case "not-flag":
      return { not: { flag: r.flag } };
    case "flag-is":
      return { flag: r.flag, is: r.is };
    case "has":
      return { has: r.item };
    case "lacks":
      return { not: { has: r.item } };
    case "solved":
      return { solved: r.puzzle };
    case "unsolved":
      return { not: { solved: r.puzzle } };
  }
}

/** The condition as a list of simple rules joined by all/any, or null if it's too complex to show that way. */
function parse(c: Condition | undefined): { mode: "all" | "any"; rules: Rule[] } | null {
  if (!c) return { mode: "all", rules: [] };
  const list = "all" in c ? { mode: "all" as const, items: c.all } : "any" in c ? { mode: "any" as const, items: c.any } : { mode: "all" as const, items: [c] };
  const rules = list.items.map(toRule);
  return rules.every(Boolean) ? { mode: list.mode, rules: rules as Rule[] } : null;
}

function build(mode: "all" | "any", rules: Rule[]): Condition | undefined {
  if (!rules.length) return undefined;
  if (rules.length === 1) return fromRule(rules[0]!);
  return mode === "all" ? { all: rules.map(fromRule) } : { any: rules.map(fromRule) };
}

/** "Only if …" editor for hotspots, layers and actions. */
export function ConditionEditor({ value, onChange, label = "Only if" }: { value: Condition | undefined; onChange: (c: Condition | undefined) => void; label?: string }) {
  const story = useStory();
  const parsed = parse(value);
  const [raw, setRaw] = useState<string>();
  const flags = Object.keys(story.story.flags ?? {});
  const items = (story.story.items ?? []).map((i) => i.id);
  const puzzles = story.puzzles.map((p) => p.id);

  if (!parsed) {
    return (
      <div className="st-condition">
        <span className="st-label">{label} (advanced)</span>
        <textarea
          rows={3}
          className="st-code"
          value={raw ?? JSON.stringify(value)}
          onChange={(e) => {
            setRaw(e.target.value);
            try {
              onChange(JSON.parse(e.target.value) as Condition);
            } catch {
              /* keep typing */
            }
          }}
        />
      </div>
    );
  }
  const { mode, rules } = parsed;
  const set = (next: Rule[], m = mode) => onChange(build(m, next));
  const blank = (kind: Rule["kind"]): Rule => {
    if (kind === "has" || kind === "lacks") return { kind, item: items[0] ?? "" };
    if (kind === "solved" || kind === "unsolved") return { kind, puzzle: puzzles[0] ?? "" };
    if (kind === "flag-is") return { kind, flag: flags[0] ?? "", is: true };
    return { kind, flag: flags[0] ?? "" };
  };

  return (
    <div className="st-condition">
      <span className="st-label">
        {label}
        {rules.length > 1 && (
          <select value={mode} onChange={(e) => set(rules, e.target.value as "all" | "any")} aria-label="Join rules">
            <option value="all">all of these</option>
            <option value="any">any of these</option>
          </select>
        )}
      </span>
      {rules.map((r, i) => {
        const update = (next: Rule) => set(rules.map((x, j) => (j === i ? next : x)));
        return (
          <div className="st-rule" key={i}>
            <select value={r.kind} onChange={(e) => update(blank(e.target.value as Rule["kind"]))} aria-label="Rule">
              {KINDS.map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
            {"flag" in r && (
              <Pick value={r.flag} options={flags} onChange={(flag) => update({ ...r, flag })} empty="no flags yet (add them under Flags & items)" />
            )}
            {r.kind === "flag-is" && (
              <input type="text" aria-label="Value" value={String(r.is)} onChange={(e) => update({ ...r, is: parseValue(e.target.value) })} />
            )}
            {"item" in r && <Pick value={r.item} options={items} onChange={(item) => update({ ...r, item })} empty="no items yet" />}
            {"puzzle" in r && <Pick value={r.puzzle} options={puzzles} onChange={(puzzle) => update({ ...r, puzzle })} empty="no puzzles yet" />}
            <button type="button" className="st-icon" aria-label="Remove rule" onClick={() => set(rules.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="st-link" onClick={() => set([...rules, blank(flags.length ? "flag" : items.length ? "has" : "solved")])}>
        + {rules.length ? "another rule" : "add a condition"}
      </button>
    </div>
  );
}

export function parseValue(text: string): FlagValue {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text.trim() !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

export function Pick({ value, options, onChange, empty, label }: { value: string; options: string[]; onChange: (v: string) => void; empty?: string; label?: string }) {
  if (!options.length) return <span className="st-muted">{empty ?? "nothing to choose"}</span>;
  return (
    <select value={options.includes(value) ? value : ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {!options.includes(value) && <option value="">{value ? `${value} (missing)` : "Choose…"}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
