import { useEffect, useState } from "react";
import { StorySession } from "@storygames/engine";
import { validatePack, type StoryPack } from "@storygames/pack-spec";
import { puzzleLogic, puzzleViews } from "@storygames/puzzles";
import { StoryPlayer } from "@storygames/ui";
import { clearSave, importsFor, loadSaga, loadSave, recordExports, writeSave } from "./storage.ts";

/** Pack folder to play. Until the library screen exists (Milestone 3), pick one with ?pack=. */
const packBase = (() => {
  const p = new URLSearchParams(location.search).get("pack") ?? "packs/test-story/";
  return p.endsWith("/") ? p : `${p}/`;
})();
const assetUrl = (path: string) => new URL(path, new URL(packBase, location.href)).href;

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; pack: StoryPack };

export function App() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [session, setSession] = useState<StorySession | null>(null);

  useEffect(() => {
    fetch(assetUrl("pack.json"), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`could not load ${packBase}pack.json (${r.status})`);
        return r.json();
      })
      .then((json) => {
        const result = validatePack(json);
        if (!result.ok) throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
        setLoad({ status: "ready", pack: result.pack });
      })
      .catch((e: Error) => setLoad({ status: "error", message: e.message }));
  }, []);

  useEffect(() => {
    if (load.status !== "ready") return;
    const { pack } = load;
    let s: StorySession;
    try {
      s = new StorySession(pack, {
        puzzles: puzzleLogic,
        save: loadSave(pack.manifest.id),
        imports: importsFor(pack.imports, loadSaga()),
      });
    } catch (e) {
      setLoad({ status: "error", message: (e as Error).message });
      return;
    }
    // Autosave at every meaningful step; on completion, record exports for sequels.
    const off = s.onEvent((e) => {
      if (e.type === "completed") {
        recordExports(pack.manifest.id, s.exports());
        clearSave(pack.manifest.id);
      } else {
        writeSave(s.save());
      }
    });
    const onHide = () => {
      if (!s.view().completed) writeSave(s.save());
    };
    document.addEventListener("visibilitychange", onHide);
    s.start();
    setSession(s);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [load]);

  if (load.status === "error") {
    return <pre style={{ padding: 16, whiteSpace: "pre-wrap" }}>Couldn't open this story.{"\n\n"}{load.message}</pre>;
  }
  if (!session) return null;

  return (
    <StoryPlayer
      session={session}
      assetUrl={assetUrl}
      puzzleViews={puzzleViews}
      onRestart={() => {
        clearSave(session.pack.manifest.id);
        setLoad({ ...load });
      }}
    />
  );
}
