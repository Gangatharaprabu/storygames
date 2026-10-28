import { useState } from "react";
import { bump, compareVersions, promote, publishedVersions, publishPack, readChannel, rollback, unpublish, type Channel } from "@storygames/builder";
import type { Problem } from "@storygames/pack-spec";
import { apiStore } from "../../api.ts";
import { buildDraft } from "../../build.ts";
import { Problems } from "../../components/Problems.tsx";
import { SERIES, type SeriesJson } from "../../drafts.ts";
import { useAsync, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

const PLAYER = ((import.meta.env.VITE_PLAYER_URL as string | undefined) ?? "http://localhost:5173/").replace(/\/?$/, "/");

export function PublishTab() {
  const { api, drafts } = useStudio();
  const r = useStory();
  const store = apiStore(api);
  const [busy, setBusy] = useState<string>();
  const [log, setLog] = useState<string[]>([]);
  const [problems, setProblems] = useState<{ errors: Problem[]; warnings: Problem[] }>();
  const info = useAsync(async () => {
    const [staging, live, versions] = await Promise.all([readChannel(store, "staging"), readChannel(store, "live"), publishedVersions(store, r.id)]);
    return { staging: staging.stories[r.id]?.version, live: live.stories[r.id]?.version, versions };
  }, [r.id]);

  const version = r.story.version;
  const versions = info.data?.versions ?? [];
  const taken = versions.includes(version);
  const latest = versions.at(-1);
  const suggestion = latest && compareVersions(latest, version) >= 0 ? bump(latest) : bump(version);
  const say = (line: string) => setLog((l) => [...l, line]);

  const act = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setLog([]);
    try {
      await fn();
    } catch (e) {
      say(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(undefined);
      info.reload();
    }
  };

  const check = () =>
    act("Checking", async () => {
      await drafts.flush();
      const d = await buildDraft(api, r.id);
      setProblems({ errors: d.build.errors, warnings: d.build.warnings });
      say(d.build.ok ? "✓ Everything checks out." : "Fix the problems below, then publish.");
    });

  const publish = () =>
    act("Publishing", async () => {
      await drafts.flush();
      say("Building…");
      const d = await buildDraft(api, r.id);
      setProblems({ errors: d.build.errors, warnings: d.build.warnings });
      if (!d.build.ok) return say("Nothing was published: fix the problems below first.");
      say("Uploading…");
      const files = await d.files();
      const seriesId = r.story.series?.id;
      const series = seriesId ? await api.json<SeriesJson>(`${SERIES}${seriesId}.json`) : undefined;
      await publishPack({
        store,
        pack: d.build.pack!,
        files,
        series: series ? [{ id: series.id, title: series.title, synopsis: series.synopsis ?? "" }] : [],
        channel: "staging",
        log: say,
      });
      say(`✓ ${r.story.title} ${version} is on the staging site.`);
    });

  const pin = (label: string, fn: () => Promise<unknown>, done: string) => act(label, async () => { await fn(); say(done); });

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>Publish</h2>
      </header>

      <section className="st-card">
        <h3>Where it is now</h3>
        <dl className="st-status">
          <div><dt>Staging (only you)</dt><dd>{info.data ? info.data.staging ?? "not published" : "…"}</dd></div>
          <div><dt>Live (everyone)</dt><dd>{info.data ? info.data.live ?? "not live" : "…"}</dd></div>
          <div><dt>Versions published</dt><dd>{versions.length ? versions.join(", ") : "none yet"}</dd></div>
        </dl>
        <p className="st-hint">
          See staging at <a href={`${PLAYER}?channel=staging`} target="_blank" rel="noreferrer">{PLAYER}?channel=staging</a>
        </p>
      </section>

      <section className="st-card">
        <h3>1. Publish to staging</h3>
        <p className="st-muted">Every publish is a new version that never changes, so players in the middle of the story aren't disturbed. Staging is only visible with the staging link.</p>
        <div className="st-row st-align-end">
          <label className="st-field">
            <span className="st-label">Version</span>
            <input type="text" value={version} onChange={(e) => r.setStory({ ...r.story, version: e.target.value.trim() })} pattern="\d+\.\d+\.\d+" />
          </label>
          {taken && (
            <button type="button" className="st-button" onClick={() => r.setStory({ ...r.story, version: suggestion })}>
              Use {suggestion}
            </button>
          )}
        </div>
        {taken && <p className="st-warning">{version} is already published. Publishing again only works if nothing changed; otherwise use a new version.</p>}
        <div className="st-row">
          <button type="button" className="st-button" disabled={Boolean(busy)} onClick={() => void check()}>
            Check for problems
          </button>
          <button type="button" className="st-button st-primary" disabled={Boolean(busy)} onClick={() => void publish()}>
            {busy === "Publishing" ? "Publishing…" : `Publish ${version} to staging`}
          </button>
        </div>
      </section>

      <section className="st-card">
        <h3>2. Make it live</h3>
        <p className="st-muted">Puts the staging version in front of everyone.</p>
        <div className="st-row">
          <button
            type="button"
            className="st-button st-primary"
            disabled={Boolean(busy) || !info.data?.staging || info.data.staging === info.data.live}
            onClick={() => void pin("Promoting", () => promote(store, r.id), `✓ ${info.data?.staging} is live.`)}
          >
            {!info.data?.staging ? "Publish to staging first" : info.data.staging !== info.data.live ? `Make ${info.data.staging} live` : "Live is up to date"}
          </button>
        </div>
      </section>

      {versions.length > 0 && (
        <section className="st-card">
          <h3>Go back or take down</h3>
          <ul className="st-plain st-versions">
            {[...versions].reverse().map((v) => (
              <li key={v}>
                <code>{v}</code>
                {v === info.data?.live && <span className="st-badge">live</span>}
                {v === info.data?.staging && <span className="st-badge">staging</span>}
                {(["staging", "live"] as Channel[]).map((ch) =>
                  (ch === "live" ? info.data?.live : info.data?.staging) === v ? null : (
                    <button key={ch} type="button" className="st-link" disabled={Boolean(busy)} onClick={() => void pin("Rolling back", () => rollback(store, r.id, v, ch), `✓ ${ch} now has ${v}.`)}>
                      put in {ch}
                    </button>
                  ),
                )}
              </li>
            ))}
          </ul>
          <div className="st-row">
            {info.data?.live && (
              <button type="button" className="st-button st-danger" disabled={Boolean(busy)} onClick={() => confirm("Take the story off the live site? Its files are kept, so you can put it back.") && void pin("Unpublishing", () => unpublish(store, r.id, "live"), "✓ Taken off the live site.")}>
                Take off the live site
              </button>
            )}
            {info.data?.staging && (
              <button type="button" className="st-button" disabled={Boolean(busy)} onClick={() => void pin("Unpublishing", () => unpublish(store, r.id, "staging"), "✓ Taken off staging.")}>
                Take off staging
              </button>
            )}
          </div>
        </section>
      )}

      {(busy || log.length > 0) && (
        <pre className="st-log" role="status">
          {busy ? `${busy}…\n` : ""}
          {log.join("\n")}
        </pre>
      )}
      {problems && <Problems errors={problems.errors} warnings={problems.warnings} />}
    </div>
  );
}
