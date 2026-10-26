import { useState } from "react";
import type { PuzzleViewProps } from "../types.ts";
import type { CombinationLockConfig } from "./logic.ts";

/**
 * Skin slots:
 *   `body` – the lock face behind the dials
 *   `dial` – background of each dial
 */
export function CombinationLockView({ config, skin, onSubmit }: PuzzleViewProps<CombinationLockConfig>) {
  const [positions, setPositions] = useState(() => Array.from({ length: config.dials }, () => 0));
  const [wrong, setWrong] = useState(false);
  const n = config.symbols.length;

  const turn = (dial: number, by: number) => {
    setWrong(false);
    setPositions((p) => p.map((v, i) => (i === dial ? (v + by + n) % n : v)));
  };

  const submit = () => {
    const ok = onSubmit(positions.map((p) => config.symbols[p]!));
    if (!ok) setWrong(true);
  };

  return (
    <div
      className={`sg-lock${wrong ? " sg-shake" : ""}`}
      style={skin.body ? { backgroundImage: `url(${skin.body})` } : undefined}
    >
      <div className="sg-lock-dials">
        {positions.map((p, i) => (
          <div className="sg-lock-dial" key={i} style={skin.dial ? { backgroundImage: `url(${skin.dial})` } : undefined}>
            <button type="button" aria-label={`Dial ${i + 1} up`} onClick={() => turn(i, 1)}>▲</button>
            <span className="sg-lock-symbol" data-testid={`dial-${i}`}>{config.symbols[p]}</span>
            <button type="button" aria-label={`Dial ${i + 1} down`} onClick={() => turn(i, -1)}>▼</button>
          </div>
        ))}
      </div>
      <button type="button" className="sg-button sg-primary" onClick={submit}>Try it</button>
      {wrong && <p className="sg-lock-wrong" role="status">It doesn't budge.</p>}
    </div>
  );
}
