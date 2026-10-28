import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CANVAS } from "@storygames/pack-spec";
import { useFileUrl } from "../state.tsx";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  id: string;
  kind: "hotspot" | "layer";
  rect: Rect;
  label: string;
  /** Layer image (bucket key). */
  imageKey?: string;
}

type Drag =
  | { mode: "draw"; start: { x: number; y: number }; rect: Rect }
  | { mode: "move"; id: string; start: { x: number; y: number }; orig: Rect; rect: Rect }
  | { mode: "resize"; id: string; corner: "nw" | "ne" | "sw" | "se"; orig: Rect; rect: Rect };

const MIN = 40;
const round = (n: number) => Math.round(n / 5) * 5;
const clampRect = (r: Rect): Rect => {
  const w = Math.max(MIN, Math.min(r.w, CANVAS.width));
  const h = Math.max(MIN, Math.min(r.h, CANVAS.height));
  return { x: round(Math.max(0, Math.min(r.x, CANVAS.width - w))), y: round(Math.max(0, Math.min(r.y, CANVAS.height - h))), w: round(w), h: round(h) };
};

/**
 * The scene at 9:16 with its layers and hotspots. Drag on empty space to draw a hotspot;
 * drag a box to move it, its corners to resize it.
 */
export function SceneCanvas({
  backgroundKey,
  boxes,
  selected,
  onSelect,
  onChange,
  onDraw,
  camera,
}: {
  backgroundKey: string | undefined;
  boxes: Box[];
  selected: string | undefined;
  onSelect: (id: string | undefined) => void;
  onChange: (id: string, rect: Rect) => void;
  onDraw: (rect: Rect) => void;
  /** Shows the opening camera framing. */
  camera?: { x: number; y: number; zoom: number };
}) {
  const bg = useFileUrl(backgroundKey);
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const [pointer, setPointer] = useState<{ x: number; y: number }>();

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const box = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - box.left) / box.width) * CANVAS.width, y: ((e.clientY - box.top) / box.height) * CANVAS.height };
  };

  const down = (e: ReactPointerEvent, target?: { id: string; corner?: "nw" | "ne" | "sw" | "se" }) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    ref.current!.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    if (!target) {
      onSelect(undefined);
      setDrag({ mode: "draw", start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
      return;
    }
    onSelect(target.id);
    const orig = boxes.find((b) => b.id === target.id)!.rect;
    setDrag(target.corner ? { mode: "resize", id: target.id, corner: target.corner, orig, rect: orig } : { mode: "move", id: target.id, start: p, orig, rect: orig });
  };

  const moveTo = (e: ReactPointerEvent) => {
    const p = toCanvas(e);
    setPointer({ x: Math.round(p.x), y: Math.round(p.y) });
    if (!drag) return;
    if (drag.mode === "draw") {
      const x = Math.min(p.x, drag.start.x);
      const y = Math.min(p.y, drag.start.y);
      setDrag({ ...drag, rect: { x, y, w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) } });
    } else if (drag.mode === "move") {
      setDrag({ ...drag, rect: clampRect({ ...drag.orig, x: drag.orig.x + p.x - drag.start.x, y: drag.orig.y + p.y - drag.start.y }) });
    } else {
      const o = drag.orig;
      const left = drag.corner.includes("w") ? Math.min(p.x, o.x + o.w - MIN) : o.x;
      const right = drag.corner.includes("e") ? Math.max(p.x, o.x + MIN) : o.x + o.w;
      const top = drag.corner.includes("n") ? Math.min(p.y, o.y + o.h - MIN) : o.y;
      const bottom = drag.corner.includes("s") ? Math.max(p.y, o.y + MIN) : o.y + o.h;
      setDrag({ ...drag, rect: clampRect({ x: left, y: top, w: right - left, h: bottom - top }) });
    }
  };

  const up = () => {
    if (drag?.mode === "draw" && drag.rect.w >= 30 && drag.rect.h >= 30) onDraw(clampRect(drag.rect));
    else if (drag && drag.mode !== "draw" && (drag.rect.x !== drag.orig.x || drag.rect.y !== drag.orig.y || drag.rect.w !== drag.orig.w || drag.rect.h !== drag.orig.h)) onChange(drag.id, drag.rect);
    setDrag(undefined);
  };

  const pct = (r: Rect) => ({
    left: `${(r.x / CANVAS.width) * 100}%`,
    top: `${(r.y / CANVAS.height) * 100}%`,
    width: `${(r.w / CANVAS.width) * 100}%`,
    height: `${(r.h / CANVAS.height) * 100}%`,
  });
  const live = (b: Box) => (drag && drag.mode !== "draw" && drag.id === b.id ? drag.rect : b.rect);
  const cam = camera && camera.zoom > 1 ? { w: CANVAS.width / camera.zoom, h: CANVAS.height / camera.zoom } : undefined;

  return (
    <div className="st-canvas-wrap">
      <div
        ref={ref}
        className="st-canvas"
        data-testid="scene-canvas"
        onPointerDown={(e) => down(e)}
        onPointerMove={moveTo}
        onPointerUp={up}
        onPointerLeave={() => setPointer(undefined)}
      >
        {bg && <img className="st-canvas-bg" src={bg} alt="" draggable={false} />}
        {boxes.map((b) => (
          <LayerOrHotspot key={`${b.kind}:${b.id}`} box={b} rect={live(b)} style={pct(live(b))} selected={selected === b.id} onDown={down} />
        ))}
        {cam && camera && (
          <div
            className="st-camera-frame"
            style={pct({ x: Math.max(0, Math.min(camera.x - cam.w / 2, CANVAS.width - cam.w)), y: Math.max(0, Math.min(camera.y - cam.h / 2, CANVAS.height - cam.h)), w: cam.w, h: cam.h })}
          >
            <span>opening camera</span>
          </div>
        )}
        {drag?.mode === "draw" && <div className="st-box st-box-drawing" style={pct(drag.rect)} />}
      </div>
      <p className="st-canvas-help">
        {pointer ? `x ${pointer.x}, y ${pointer.y}` : "Drag on the picture to add a hotspot. Drag boxes to move them, corners to resize."}
      </p>
    </div>
  );
}

function LayerOrHotspot({
  box,
  rect,
  style,
  selected,
  onDown,
}: {
  box: Box;
  rect: Rect;
  style: React.CSSProperties;
  selected: boolean;
  onDown: (e: ReactPointerEvent, t: { id: string; corner?: "nw" | "ne" | "sw" | "se" }) => void;
}) {
  const img = useFileUrl(box.imageKey);
  return (
    <div
      className={`st-box st-box-${box.kind}${selected ? " st-selected" : ""}`}
      style={style}
      data-box={box.id}
      title={`${box.label} (${rect.x}, ${rect.y}, ${rect.w}×${rect.h})`}
      onPointerDown={(e) => onDown(e, { id: box.id })}
    >
      {img && <img src={img} alt="" draggable={false} />}
      <span className="st-box-label">{box.label}</span>
      {selected &&
        (["nw", "ne", "sw", "se"] as const).map((c) => (
          <span key={c} className={`st-handle st-handle-${c}`} onPointerDown={(e) => onDown(e, { id: box.id, corner: c })} />
        ))}
    </div>
  );
}
