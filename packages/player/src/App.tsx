import { useEffect, useMemo, useState } from "react";
import { StorySession } from "@storygames/engine";
import { validatePack, type StoryPack } from "@storygames/pack-spec";
import { puzzleLogic, puzzleViews } from "@storygames/puzzles";
import { DebugPanel, SoundBoard, StoryPlayer, TitleScreen } from "@storygames/ui";
import { clearSave, importsFor, loadSaga, loadSave, recordExports, writeSave } from "./storage.ts";

const params = new URLSearchParams(location.search);

/** Pack folder to play. Until the library screen exists (Milestone 3), pick one with ?pack=. */
const packBase = (() => {
  const p = params.get("pack") ?? import.meta.env.VITE_DEFAULT_PACK ?? "packs/test-story/";
  return p.endsWith("/") ? p : `${p}/`;
})();
const assetUrl = (path: string) => new URL(path, new URL(packBase, location.href)).href;

/** Author tools: always on in `pnpm dev`, and on any build with `?debug` in the URL. */
const debugEnabled = import.meta.env.DEV || params.has("debug");

const sound = new SoundBoard();

type Screen =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "title"; pack: StoryPack }
  | { name: "playing"; pack: StoryPack; fresh: boolean; run: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });

  useEffect(() => {
    fetch(assetUrl("pack.json"), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`could not load ${packBase}pack.json (${r.status})`);
        return r.json();
      })
      .then((json) => {
        const result = validatePack(json);
        if (!result.ok) throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
        // While writing, a reload (e.g. after a rebuild) drops you straight back where you were.
        const resume = debugEnabled && loadSave(result.pack.manifest.id);
        setScreen(resume ? { name: "playing", pack: result.pack, fresh: false, run: 0 } : { name: "title", pack: result.pack });
      })
      .catch((e: Error) => setScreen({ name: "error", message: e.message }));
  }, []);

  if (screen.name === "loading") return null;
  if (screen.name === "error") {
    return <pre style={{ padding: 16, whiteSpace: "pre-wrap" }}>Couldn't open this story.{"\n\n"}{screen.message}</pre>;
  }
  if (screen.name === "title") {
    const { pack } = screen;
    return (
      <TitleScreen
        pack={pack}
        assetUrl={assetUrl}
        hasSave={Boolean(loadSave(pack.manifest.id))}
        onStart={(fresh) => {
          if (fresh) clearSave(pack.manifest.id);
          setScreen({ name: "playing", pack, fresh, run: 0 });
        }}
      />
    );
  }
  return (
    <Playing
      key={screen.run}
      pack={screen.pack}
      onRestart={() => {
        clearSave(screen.pack.manifest.id);
        setScreen({ ...screen, fresh: true, run: screen.run + 1 });
      }}
      onTitle={() => setScreen({ name: "title", pack: screen.pack })}
    />
  );
}

function Playing({ pack, onRestart, onTitle }: { pack: StoryPack; onRestart: () => void; onTitle: () => void }) {
  const result = useMemo(() => {
    try {
      return {
        session: new StorySession(pack, {
          puzzles: puzzleLogic,
          save: loadSave(pack.manifest.id),
          imports: importsFor(pack.imports, loadSaga()),
        }),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [pack]);

  useEffect(() => {
    const s = result.session;
    if (!s) return;
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
    window.addEventListener("pagehide", onHide);
    s.start();
    return () => {
      off();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [result, pack]);

  if (!result.session) return <pre style={{ padding: 16, whiteSpace: "pre-wrap" }}>Couldn't start this story.{"\n\n"}{result.error}</pre>;

  return (
    <StoryPlayer session={result.session} assetUrl={assetUrl} puzzleViews={puzzleViews} sound={sound} onRestart={onTitle}>
      {debugEnabled && <DebugPanel session={result.session} onRestart={onRestart} />}
    </StoryPlayer>
  );
}
