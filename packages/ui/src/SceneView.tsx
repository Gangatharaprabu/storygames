import type { SessionView } from "@storygames/engine";
import { rectStyle } from "./geometry.ts";

export function SceneView({
  view,
  assetUrl,
  onHotspot,
}: {
  view: SessionView;
  assetUrl: (path: string) => string;
  onHotspot: (id: string) => void;
}) {
  return (
    <div className="sg-scene" data-scene={view.scene.id}>
      {/* Keyed by scene, so every scene change fades in. */}
      <div className="sg-scene-art" key={view.scene.id}>
        <img className="sg-fill" src={assetUrl(view.scene.background)} alt="" draggable={false} />
        {view.layers.map((l) => (
          <img key={l.id} className="sg-layer" style={rectStyle(l.rect)} src={assetUrl(l.image)} alt="" draggable={false} />
        ))}
      </div>
      {view.hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          className="sg-hotspot"
          style={rectStyle(h.rect)}
          aria-label={h.label}
          title={h.label}
          disabled={view.busy || view.completed}
          data-hotspot={h.id}
          onClick={() => onHotspot(h.id)}
        >
          <span className="sg-hotspot-marker" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
