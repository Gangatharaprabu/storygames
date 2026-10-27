import { useEffect, useMemo, useState } from "react";
import { StorySession } from "@storygames/engine";
import { validatePack, type Catalog, type CatalogEntry, type StoryPack } from "@storygames/pack-spec";
import { puzzleLogic, puzzleViews } from "@storygames/puzzles";
import { DebugPanel, StoryPlayer } from "@storygames/ui";
import { ShareButton } from "../components/Actions.tsx";
import { nextEpisode, packUrl } from "../data/catalog.ts";
import { percentDone } from "../data/profile.ts";
import { href, navigate } from "../router.ts";
import { debugEnabled, profileStore, sound } from "../state.ts";
import { clearSave, importsFor, loadSave, writeSave } from "../storage.ts";
import { NotFound } from "./NotFound.tsx";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; pack: StoryPack };

export function Play({ catalog, id }: { catalog: Catalog; id: string }) {
  const entry = catalog.stories.find((s) => s.id === id);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!entry) return;
    fetch(packUrl(`${entry.pack}pack.json`), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`could not load the story (${r.status})`);
        return r.json();
      })
      .then((json) => {
        const result = validatePack(json);
        if (!result.ok) throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join("\n"));
        setLoad({ status: "ready", pack: result.pack });
      })
      .catch((e: Error) => setLoad({ status: "error", message: e.message }));
  }, [entry]);

  if (!entry) return <NotFound what="That story" />;
  if (load.status === "loading") return <div className="loading" aria-label="Loading" />;
  if (load.status === "error") return <Failure message={load.message} id={id} />;
  return (
    <Session
      key={run}
      entry={entry}
      catalog={catalog}
      pack={load.pack}
      onRestart={() => {
        clearSave(id);
        profileStore.abandon(id);
        setRun((r) => r + 1);
      }}
    />
  );
}

function Session({ entry, catalog, pack, onRestart }: { entry: CatalogEntry; catalog: Catalog; pack: StoryPack; onRestart: () => void }) {
  const id = pack.manifest.id;
  const assetUrl = useMemo(() => (path: string) => packUrl(`${entry.pack}${path}`), [entry.pack]);

  const result = useMemo(() => {
    try {
      return {
        session: new StorySession(pack, {
          puzzles: puzzleLogic,
          save: loadSave(id),
          imports: importsFor(pack.imports, profileStore.get().saga),
        }),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [pack, id]);

  useEffect(() => {
    const s = result.session;
    if (!s) return;
    const totals = { scenes: pack.scenes.length, puzzles: pack.puzzles.length };
    const progress = () => profileStore.recordProgress(id, percentDone(s.view().state, totals));

    // Autosave + progress at every meaningful step; on completion, record the saga for sequels.
    const off = s.onEvent((e) => {
      if (e.type === "completed") {
        profileStore.finish(id, s.exports());
        clearSave(id);
      } else {
        writeSave(s.save());
        progress();
      }
    });
    const onHide = () => {
      if (!s.view().completed) writeSave(s.save());
    };
    // Count play time while the page is visible.
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") profileStore.addPlaytime(id, 10);
    }, 10_000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    s.start();
    if (!s.view().completed) progress();
    return () => {
      off();
      clearInterval(tick);
      onHide();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [result, pack, id]);

  if (!result.session) return <Failure message={result.error!} id={id} />;
  const next = nextEpisode(catalog.stories, entry);

  return (
    <StoryPlayer
      session={result.session}
      assetUrl={assetUrl}
      puzzleViews={puzzleViews}
      sound={sound}
      onExit={() => navigate(href.story(id))}
      ending={
        <>
          {next && (
            <a className="sg-button sg-primary" href={href.story(next.id)}>
              Next: {next.title}
            </a>
          )}
          <ShareButton story={entry} className={next ? "sg-button" : "sg-button sg-primary"} />
          <a className="sg-button" href={href.home()}>More stories</a>
        </>
      }
    >
      {debugEnabled && <DebugPanel session={result.session} onRestart={onRestart} />}
    </StoryPlayer>
  );
}

function Failure({ message, id }: { message: string; id: string }) {
  return (
    <section className="page empty">
      <h1 className="page-title">Couldn't open this story</h1>
      <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>{message}</pre>
      <a className="btn" href={href.story(id)}>Back</a>
    </section>
  );
}
