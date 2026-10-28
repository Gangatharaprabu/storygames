import type { Problem } from "@storygames/pack-spec";

/** Build errors and warnings, in plain words where we can. */
export function Problems({ errors, warnings }: { errors: Problem[]; warnings: Problem[] }) {
  if (!errors.length && !warnings.length) return null;
  return (
    <div className="st-problems" role="alert">
      {errors.length > 0 && <h3>{errors.length === 1 ? "1 thing to fix" : `${errors.length} things to fix`}</h3>}
      <ul>
        {errors.map((p, i) => (
          <li key={`e${i}`} className="st-problem-error">
            <code>{p.path}</code> {p.message}
          </li>
        ))}
        {warnings.map((p, i) => (
          <li key={`w${i}`} className="st-problem-warning">
            <code>{p.path}</code> {p.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
