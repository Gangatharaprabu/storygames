import { Story } from "inkjs";
import type { CharacterSnapshot, FlagValue } from "@storygames/pack-spec";

export interface DialogueLine {
  /** Undefined for narration. */
  speaker?: CharacterSnapshot;
  expression?: string;
  text: string;
  /** Set when the player must pick one before continuing. */
  choices: string[] | null;
}

export type DialogueEffect = { give: string } | { take: string };

/**
 * Thin wrapper over an ink story.
 *
 * Writing conventions (kept simple for authors):
 *   `tomo: Evening, traveller.`  → speaker by character id or name, case-insensitive
 *   `... #happy`                 → a tag naming one of the speaker's portraits sets the expression
 *   `... #give:rope` / `#take:rope` → inventory effects
 * Ink VARs whose names match story flags are kept in sync with them.
 */
export class InkBridge {
  private story: Story;
  private byName = new Map<string, CharacterSnapshot>();

  constructor(json: string, characters: CharacterSnapshot[]) {
    this.story = new Story(json);
    for (const c of characters) {
      this.byName.set(c.id.toLowerCase(), c);
      this.byName.set(c.name.toLowerCase(), c);
    }
  }

  start(knot: string, flags: Record<string, FlagValue>) {
    this.pushFlags(flags);
    this.story.ChoosePathString(knot);
  }

  /** Next line, or null when the knot is finished. */
  next(): { line: DialogueLine; effects: DialogueEffect[] } | null {
    if (!this.story.canContinue) return null;
    const raw = (this.story.Continue() ?? "").trim();
    const tags = this.story.currentTags ?? [];
    if (!raw && this.story.canContinue) return this.next();

    let speaker: CharacterSnapshot | undefined;
    let text = raw;
    const m = /^([^:]{1,32}):\s*(.*)$/.exec(raw);
    if (m) {
      const found = this.byName.get(m[1]!.trim().toLowerCase());
      if (found) {
        speaker = found;
        text = m[2]!;
      }
    }

    let expression = speaker?.defaultExpression;
    const effects: DialogueEffect[] = [];
    for (const tag of tags.map((t) => t.trim())) {
      const [key, value] = tag.split(":").map((s) => s.trim());
      if (key === "give" && value) effects.push({ give: value });
      else if (key === "take" && value) effects.push({ take: value });
      else if (speaker && key && !value && speaker.portraits[key]) expression = key;
    }

    const choices = !this.story.canContinue && this.story.currentChoices.length
      ? this.story.currentChoices.map((c) => c.text)
      : null;
    return { line: { speaker, expression, text, choices }, effects };
  }

  choose(index: number) {
    this.story.ChooseChoiceIndex(index);
  }

  /** Copy ink's values back into flags (ink may have changed them). */
  pullFlags(flags: Record<string, FlagValue>): Record<string, FlagValue> {
    const out = { ...flags };
    for (const name of Object.keys(flags)) {
      if (this.story.variablesState.GlobalVariableExistsWithName(name)) {
        const v = this.story.variablesState.$(name);
        if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") out[name] = v;
      }
    }
    return out;
  }

  saveState(): string {
    return this.story.state.ToJson();
  }

  loadState(json: string) {
    this.story.state.LoadJson(json);
  }

  private pushFlags(flags: Record<string, FlagValue>) {
    for (const [name, value] of Object.entries(flags)) {
      if (this.story.variablesState.GlobalVariableExistsWithName(name)) {
        this.story.variablesState.$(name, value);
      }
    }
  }
}
