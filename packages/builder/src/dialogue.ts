import { z } from "zod";
import { FlagValue, Id, type Problem } from "@storygames/pack-spec";

/*
 * Visual dialogue: conversations as a list of steps, edited in the Studio and saved as
 * narrative/dialogue.json. The build turns them into ink, so the engine only ever sees ink.
 * Hand-written ink (narrative/main.ink) still works, and both can live in one story.
 */

export type DialogueStep =
  | { type: "line"; speaker?: string; expression?: string; text: string }
  | { type: "choice"; options: Array<{ text: string; steps: DialogueStep[] }> }
  | { type: "set"; flag: string; value: FlagValue }
  | { type: "give"; item: string }
  | { type: "take"; item: string }
  | { type: "if"; flag: string; equals: FlagValue; then: DialogueStep[]; else: DialogueStep[] }
  | { type: "goto"; conversation: string };

export const DialogueStep: z.ZodType<DialogueStep> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("line"),
      /** Character id; no speaker means narration. */
      speaker: Id.optional(),
      expression: z.string().optional(),
      text: z.string().min(1),
    }),
    z.object({
      type: z.literal("choice"),
      options: z.array(z.object({ text: z.string().min(1), steps: z.array(DialogueStep) })).min(1),
    }),
    z.object({ type: z.literal("set"), flag: z.string(), value: FlagValue }),
    z.object({ type: z.literal("give"), item: Id }),
    z.object({ type: z.literal("take"), item: Id }),
    z.object({
      type: z.literal("if"),
      flag: z.string(),
      equals: FlagValue,
      then: z.array(DialogueStep),
      else: z.array(DialogueStep),
    }),
    z.object({ type: z.literal("goto"), conversation: ConversationId }),
  ]),
);

/** Conversation ids become ink knot names: lowercase letters, digits and underscores. */
export const ConversationId = z.string().regex(/^[a-z][a-z0-9_]*$/, "use lowercase letters, digits and _ (e.g. tomo_rope)");

export const Conversation = z.object({
  /** Becomes the ink knot: scenes and hotspots start it with { "do": "dialogue", "knot": id }. */
  id: ConversationId,
  /** For the author only. */
  title: z.string().optional(),
  steps: z.array(DialogueStep),
});
export type Conversation = z.infer<typeof Conversation>;

export const DialogueFile = z.object({ conversations: z.array(Conversation) });
export type DialogueFile = z.infer<typeof DialogueFile>;

/** Text as ink content: every character that means something to ink is escaped. */
export function inkText(text: string, opts: { choice?: boolean } = {}): string {
  let t = text.replace(/\s*\n\s*/g, " ").trim();
  t = t.replace(/\\/g, "\\\\").replace(/[#{}|~]/g, (c) => `\\${c}`);
  t = t.replace(/\/\//g, "/\\/").replace(/\/\*/g, "/\\*").replace(/->/g, "-\\>").replace(/<-/g, "<\\-").replace(/<>/g, "<\\>");
  if (opts.choice) t = t.replace(/[[\]]/g, (c) => `\\${c}`);
  if (/^[*+\-=]/.test(t)) t = `\\${t}`;
  return t;
}

const inkValue = (v: FlagValue) => (typeof v === "string" ? JSON.stringify(v) : String(v));

/**
 * Conversations → ink source. Each choice and condition sends the story to a generated
 * knot for that branch, which then continues with whatever followed — so branches can be
 * nested as deep as you like without ink's weave syntax.
 */
export function dialogueToInk(
  file: DialogueFile,
  flags: Record<string, FlagValue>,
  /** Flags already declared as VARs elsewhere (hand-written ink). */
  declared: Set<string> = new Set(),
): { ink: string; problems: Problem[] } {
  const problems: Problem[] = [];
  const out: string[] = [];
  for (const [name, value] of Object.entries(flags)) if (!declared.has(name)) out.push(`VAR ${name} = ${inkValue(value)}`);
  if (out.length) out.push("");
  const ids = new Set(file.conversations.map((c) => c.id));
  let counter = 0;
  let conversation = "";
  const knot = () => `${conversation}__${++counter}`;
  const pending: Array<{ name: string; steps: DialogueStep[]; then: string; where: string }> = [];

  /** Writes `steps` into the current knot; ends with a divert to `then` (a knot name or DONE). */
  const emit = (steps: DialogueStep[], then: string, where: string) => {
    const lines: string[] = [];
    const tags: string[] = []; // give/take, waiting for a line to ride on
    let lastLine = -1;
    const flushTags = () => {
      if (!tags.length) return;
      if (lastLine >= 0) lines[lastLine] += ` ${tags.map((t) => `#${t}`).join(" ")}`;
      else problems.push({ path: where, message: `"${tags.join(", ")}" needs a line of dialogue before it` });
      tags.length = 0;
    };
    for (const [i, step] of steps.entries()) {
      const path = `${where}[${i}]`;
      switch (step.type) {
        case "line": {
          let line = step.speaker ? `${step.speaker}: ${inkText(step.text)}` : inkText(step.text);
          if (step.expression) line += ` #${step.expression}`;
          lines.push(line);
          lastLine = lines.length - 1;
          flushTags();
          break;
        }
        case "set":
          if (!(step.flag in flags)) problems.push({ path, message: `unknown flag "${step.flag}"` });
          lines.push(`~ ${step.flag} = ${inkValue(step.value)}`);
          break;
        case "give":
        case "take":
          tags.push(`${step.type}:${step.item}`);
          flushTags();
          break;
        case "goto":
          if (!ids.has(step.conversation)) problems.push({ path, message: `no conversation "${step.conversation}"` });
          flushTags();
          lines.push(`-> ${step.conversation}`);
          return lines; // nothing after a goto runs
        case "choice":
        case "if": {
          flushTags();
          const rest = steps.slice(i + 1);
          const after = rest.length ? knot() : then;
          if (rest.length) pending.push({ name: after, steps: rest, then, where });
          if (step.type === "choice") {
            step.options.forEach((o, n) => {
              const name = knot();
              pending.push({ name, steps: o.steps, then: after, where: `${path}.options[${n}]` });
              // "+": sticky, so a conversation can be had again with the same options.
              lines.push(`+ [${inkText(o.text, { choice: true })}] -> ${name}`);
            });
          } else {
            if (!(step.flag in flags)) problems.push({ path, message: `unknown flag "${step.flag}"` });
            const yes = knot();
            const no = knot();
            pending.push({ name: yes, steps: step.then, then: after, where: `${path}.then` });
            pending.push({ name: no, steps: step.else, then: after, where: `${path}.else` });
            lines.push(`{ ${step.flag} == ${inkValue(step.equals)}:`, `  -> ${yes}`, `- else:`, `  -> ${no}`, `}`);
          }
          return lines;
        }
      }
    }
    if (tags.length) problems.push({ path: where, message: `"${tags.join(", ")}" needs a line of dialogue` });
    lines.push(`-> ${then}`);
    return lines;
  };

  for (const c of file.conversations) {
    if (!c.steps.length) problems.push({ path: c.id, message: "conversation is empty" });
    conversation = c.id;
    out.push(`=== ${c.id} ===`, ...emit(c.steps, "DONE", c.id), "");
    while (pending.length) {
      const p = pending.shift()!;
      out.push(`=== ${p.name} ===`, ...emit(p.steps, p.then, p.where), "");
    }
  }
  return { ink: out.join("\n"), problems };
}
