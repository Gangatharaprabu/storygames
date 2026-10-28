import { useState } from "react";
import { TRANSITIONS } from "@storygames/pack-spec";
import { ActionList } from "../../components/actions.tsx";
import { ConditionEditor } from "../../components/conditions.tsx";
import { Choice, FilePicker, Num, Text, Thumb, uploadFile } from "../../components/fields.tsx";
import { SceneCanvas, type Box, type Rect } from "../../components/SceneCanvas.tsx";
import { placeholderArt, slug, uniqueId, type SceneJson } from "../../drafts.ts";
import { backgroundAdvice } from "../../files.ts";
import { go, href } from "../../router.ts";
import { useDraft, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

export function ScenesTab({ selected }: { selected?: string }) {
  const { api } = useStudio();
  const r = useStory();
  const current = selected ?? r.story.startScene;

  const add = async () => {
    const name = prompt("Name of the new scene (e.g. “The old lighthouse”)");
    if (!name?.trim()) return;
    const id = uniqueId(slug(name), r.scenes.map((s) => s.id));
    await api.put(`${r.root}art/${id}.svg`, placeholderArt(name));
    const scene: SceneJson = { id, title: name.trim(), background: `art/${id}.svg`, layers: [], hotspots: [], onEnter: [] };
    await api.putJson(`${r.root}scenes/${id}.json`, scene);
    r.reload();
    go("story", r.id, "scenes", id);
  };

  return (
    <div className="st-split">
      <aside className="st-list" aria-label="Scenes">
        <div className="st-list-head">
          <h2>Scenes</h2>
          <button type="button" className="st-button" onClick={() => void add()}>
            + New scene
          </button>
        </div>
        <ul>
          {r.scenes.map((s) => (
            <li key={s.id}>
              <a href={href("story", r.id, "scenes", s.id)} aria-current={s.id === current ? "page" : undefined} className="st-list-item">
                <Thumb fileKey={r.root + s.background} className="st-scene-thumb" />
                <span>
                  {s.title ?? s.id}
                  {s.id === r.story.startScene && <span className="st-badge">first</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </aside>
      {r.scenes.some((s) => s.id === current) ? <SceneEditor key={current} sceneId={current} /> : <p className="st-page st-muted">Pick a scene.</p>}
    </div>
  );
}

function SceneEditor({ sceneId }: { sceneId: string }) {
  const { api, drafts } = useStudio();
  const r = useStory();
  const key = `${r.root}scenes/${sceneId}.json`;
  const [scene, setScene] = useDraft<SceneJson>(key);
  const [selected, setSelected] = useState<string>();
  const [advice, setAdvice] = useState<string>();
  if (!scene) return null;

  const set = (patch: Partial<SceneJson>) => setScene({ ...scene, ...patch });
  const hotspots = scene.hotspots ?? [];
  const layers = scene.layers ?? [];
  const boxes: Box[] = [
    ...layers.map((l) => ({ id: `layer:${l.id}`, kind: "layer" as const, rect: l.rect, label: l.id, imageKey: r.root + l.image })),
    ...hotspots.map((h) => ({ id: h.id, kind: "hotspot" as const, rect: h.rect, label: h.label })),
  ];
  const hotspot = hotspots.find((h) => h.id === selected);
  const layer = layers.find((l) => `layer:${l.id}` === selected);

  const moveBox = (id: string, rect: Rect) => {
    if (id.startsWith("layer:")) set({ layers: layers.map((l) => (`layer:${l.id}` === id ? { ...l, rect } : l)) });
    else set({ hotspots: hotspots.map((h) => (h.id === id ? { ...h, rect } : h)) });
  };
  const draw = (rect: Rect) => {
    const n = hotspots.length + 1;
    const id = uniqueId(`spot-${n}`, hotspots.map((h) => h.id));
    set({ hotspots: [...hotspots, { id, label: `Something interesting ${n}`, rect, actions: [] }] });
    setSelected(id);
  };
  const addLayer = async (file: File | undefined) => {
    if (!file) return;
    const { path, prepared } = await uploadFile(api, r.root, "art/", file);
    const w = Math.min(600, prepared.width ?? 400);
    const h = prepared.width && prepared.height ? Math.round((w * prepared.height) / prepared.width) : 400;
    const id = uniqueId(slug(file.name.replace(/\.[^.]+$/, "")), layers.map((l) => l.id));
    set({ layers: [...layers, { id, image: path, rect: { x: 540 - w / 2, y: 960 - h / 2, w, h } }] });
    setSelected(`layer:${id}`);
  };
  const remove = async () => {
    if (!confirm(`Delete the scene “${scene.title ?? scene.id}”?`)) return;
    await drafts.remove(key);
    r.reload();
    go("story", r.id, "scenes");
  };

  return (
    <div className="st-page st-scene-editor">
      <header className="st-page-head">
        <h2>{scene.title ?? scene.id}</h2>
        {scene.id !== r.story.startScene && (
          <button type="button" className="st-button st-danger" onClick={() => void remove()}>
            Delete scene
          </button>
        )}
      </header>
      <div className="st-scene-layout">
        <div>
          <SceneCanvas
            backgroundKey={r.root + scene.background}
            boxes={boxes}
            selected={selected}
            onSelect={setSelected}
            onChange={moveBox}
            onDraw={draw}
            camera={scene.camera ? { x: scene.camera.x ?? 540, y: scene.camera.y ?? 960, zoom: scene.camera.zoom ?? 1 } : undefined}
          />
          <label className="st-button st-file-label">
            + Add a layer (picture over the background)
            <input type="file" hidden accept="image/png,image/webp,image/svg+xml" onChange={(e) => void addLayer(e.target.files?.[0])} />
          </label>
        </div>

        <div className="st-inspector">
          {hotspot ? (
            <section className="st-card" aria-label="Hotspot">
              <div className="st-card-head">
                <h3>Hotspot</h3>
                <button type="button" className="st-link" onClick={() => setSelected(undefined)}>
                  Done
                </button>
              </div>
              <Text label="What the player sees (label)" value={hotspot.label} onChange={(label) => set({ hotspots: hotspots.map((h) => (h === hotspot ? { ...h, label } : h)) })} hint="Shown on hover and read aloud by screen readers." />
              <ConditionEditor label="Only there if" value={hotspot.if} onChange={(c) => set({ hotspots: hotspots.map((h) => (h === hotspot ? { ...h, if: c } : h)) })} />
              <h4>When tapped</h4>
              <ActionList actions={hotspot.actions} onChange={(actions) => set({ hotspots: hotspots.map((h) => (h === hotspot ? { ...h, actions } : h)) })} empty="Add what happens: usually a conversation or a puzzle." />
              <button type="button" className="st-button st-danger" onClick={() => { set({ hotspots: hotspots.filter((h) => h !== hotspot) }); setSelected(undefined); }}>
                Delete hotspot
              </button>
            </section>
          ) : layer ? (
            <section className="st-card" aria-label="Layer">
              <div className="st-card-head">
                <h3>Layer “{layer.id}”</h3>
                <button type="button" className="st-link" onClick={() => setSelected(undefined)}>
                  Done
                </button>
              </div>
              <p className="st-muted">A picture over the background, e.g. an opened box that only shows once a puzzle is solved.</p>
              <ConditionEditor label="Only shown if" value={layer.if} onChange={(c) => set({ layers: layers.map((l) => (l === layer ? { ...l, if: c } : l)) })} />
              <button type="button" className="st-button st-danger" onClick={() => { set({ layers: layers.filter((l) => l !== layer) }); setSelected(undefined); }}>
                Delete layer
              </button>
            </section>
          ) : (
            <>
              <section className="st-card">
                <Text label="Scene name" value={scene.title} onChange={(title) => set({ title })} />
                <FilePicker label="Background" root={r.root} folder="art/" name={scene.id} value={scene.background} onChange={(background) => background && set({ background })} onPrepared={(p) => setAdvice(backgroundAdvice(p))} hint={advice ?? "Portrait 9:16, ideally 1080 × 1920."} />
                <FilePicker label="Music or ambience" kind="audio" root={r.root} folder="audio/" value={scene.music} onChange={(music) => set({ music })} clearable hint="Loops while the player is here." />
              </section>
              <section className="st-card">
                <h3>Opening</h3>
                <p className="st-muted">Plays every time the player arrives, like a short anime scene. When it ends, it's the player's turn to tap around.</p>
                <div className="st-row">
                  <TransitionPicker label="Arrives with" value={scene.enter} onChange={(enter) => set({ enter })} dflt={{ type: "fade-black", ms: 700 }} />
                  <TransitionPicker label="Leaves with" value={scene.exit} onChange={(exit) => set({ exit })} dflt={{ type: "fade-black", ms: 600 }} />
                </div>
                <div className="st-row">
                  <Num label="Opening camera zoom" value={scene.camera?.zoom ?? 1} min={1} max={4} step={0.1} onChange={(zoom) => set({ camera: { x: scene.camera?.x ?? 540, y: scene.camera?.y ?? 960, zoom } })} />
                  <Num label="x" value={scene.camera?.x ?? 540} min={0} max={1080} onChange={(x) => set({ camera: { ...{ y: 960, zoom: 1 }, ...scene.camera, x } })} />
                  <Num label="y" value={scene.camera?.y ?? 960} min={0} max={1920} onChange={(y) => set({ camera: { ...{ x: 540, zoom: 1 }, ...scene.camera, y } })} />
                </div>
                <ActionList actions={scene.onEnter ?? []} onChange={(onEnter) => set({ onEnter })} empty="Nothing plays: the player can explore straight away." />
              </section>
              <section className="st-card">
                <h3>Hotspots</h3>
                {!hotspots.length && <p className="st-muted">Drag on the picture to mark something the player can tap.</p>}
                <ul className="st-plain">
                  {hotspots.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="st-link" onClick={() => setSelected(h.id)}>
                        {h.label}
                      </button>
                      <span className="st-muted"> · {h.actions.length} step{h.actions.length === 1 ? "" : "s"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TransitionPicker({ label, value, onChange, dflt }: { label: string; value: SceneJson["enter"]; onChange: (t: NonNullable<SceneJson["enter"]>) => void; dflt: { type: (typeof TRANSITIONS)[number]; ms: number } }) {
  const t = { ...dflt, ...value };
  return (
    <div className="st-row">
      <Choice label={label} value={t.type} options={[...TRANSITIONS]} onChange={(type) => onChange({ ...t, type })} />
      <Num label="ms" value={t.ms} min={0} max={5000} step={100} onChange={(ms) => onChange({ ...t, ms })} />
    </div>
  );
}
