import type { DialogueLine } from "@storygames/engine";

export function DialogueBox({
  line,
  assetUrl,
  onAdvance,
  onChoose,
}: {
  line: DialogueLine;
  assetUrl: (path: string) => string;
  onAdvance: () => void;
  onChoose: (index: number) => void;
}) {
  const portrait = line.speaker && line.expression ? line.speaker.portraits[line.expression] : undefined;
  return (
    <div className="sg-dialogue" role="dialog" aria-live="polite">
      {portrait && (
        <img className="sg-portrait" src={assetUrl(portrait)} alt={`${line.speaker!.name} (${line.expression})`} />
      )}
      <div
        className="sg-dialogue-box"
        onClick={line.choices ? undefined : onAdvance}
        data-testid="dialogue"
      >
        {line.speaker && (
          <p className="sg-speaker" style={{ color: line.speaker.color }}>{line.speaker.name}</p>
        )}
        <p className={line.speaker ? "sg-line" : "sg-line sg-narration"}>{line.text}</p>
        {line.choices ? (
          <ol className="sg-choices">
            {line.choices.map((c, i) => (
              <li key={i}>
                <button type="button" className="sg-button" onClick={() => onChoose(i)}>{c}</button>
              </li>
            ))}
          </ol>
        ) : (
          <button type="button" className="sg-continue" aria-label="Continue" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
            <span aria-hidden="true">▾</span>
          </button>
        )}
      </div>
    </div>
  );
}
