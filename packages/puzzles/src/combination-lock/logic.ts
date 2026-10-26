import { z } from "zod";
import type { PuzzleType } from "@storygames/engine";

const Config = z.object({
  /** Number of dials. */
  dials: z.number().int().min(1).max(8),
  /** Symbols on every dial, in order. Defaults to 0–9. */
  symbols: z.array(z.string().min(1)).min(2).default(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
  /** The solution, one symbol per dial. */
  solution: z.array(z.string()),
}).refine((c) => c.solution.length === c.dials, { message: "solution needs one symbol per dial" })
  .refine((c) => c.solution.every((s) => c.symbols.includes(s)), { message: "solution uses a symbol not on the dials" });

export type CombinationLockConfig = z.infer<typeof Config>;

/** Answer: the symbol showing on each dial. */
export const combinationLock: PuzzleType<CombinationLockConfig, string[]> = {
  type: "combination-lock",
  parseConfig: (raw) => {
    const r = Config.safeParse(raw);
    if (!r.success) throw new Error(r.error.issues.map((i) => i.message).join("; "));
    return r.data;
  },
  check: (config, answer) =>
    Array.isArray(answer) && answer.length === config.dials && answer.every((s, i) => s === config.solution[i]),
};
