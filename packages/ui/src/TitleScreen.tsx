import type { StoryPack } from "@storygames/pack-spec";
import { RotateNotice } from "./RotateNotice.tsx";
import { themeVars } from "./theme.ts";

/** The first screen of a story. Its tap also unlocks sound in the browser. */
export function TitleScreen({
  pack,
  assetUrl,
  hasSave,
  onStart,
}: {
  pack: StoryPack;
  assetUrl: (path: string) => string;
  hasSave: boolean;
  /** `fresh` starts over even if there is a save. */
  onStart: (fresh: boolean) => void;
}) {
  const { manifest, theme } = pack;
  const art = manifest.cover ?? pack.scenes.find((s) => s.id === pack.startScene)?.background;
  return (
    <div className="sg-viewport" style={themeVars(theme, assetUrl)}>
      {art && <div className="sg-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${assetUrl(art)})` }} />}
      <main className="sg-stage sg-title" aria-label={manifest.title}>
        {art && <img className="sg-fill sg-title-art" src={assetUrl(art)} alt="" draggable={false} />}
        <div className="sg-title-card">
          {manifest.series && <p className="sg-title-kicker">Episode {manifest.series.episode}</p>}
          <h1>{manifest.title}</h1>
          {manifest.synopsis && <p className="sg-title-synopsis">{manifest.synopsis}</p>}
          <p className="sg-title-meta">About {manifest.estimatedMinutes} min</p>
          <div className="sg-title-actions">
            {hasSave && (
              <button type="button" className="sg-button sg-primary" onClick={() => onStart(false)}>Continue</button>
            )}
            <button type="button" className={hasSave ? "sg-button" : "sg-button sg-primary"} onClick={() => onStart(true)}>
              {hasSave ? "Start over" : "Play"}
            </button>
          </div>
        </div>
      </main>
      <RotateNotice />
    </div>
  );
}
