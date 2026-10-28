import { useState } from "react";
import { LongText, Text } from "../components/fields.tsx";
import { listSeries, listStories, SERIES, slug, uniqueId, type SeriesJson } from "../drafts.ts";
import { go, href } from "../router.ts";
import { useAsync, useDraft, useStudio } from "../state.tsx";

export function SeriesPage({ selected }: { selected?: string }) {
  const { api } = useStudio();
  const list = useAsync(() => listSeries(api), []);
  const stories = useAsync(() => listStories(api), []);
  const [title, setTitle] = useState("");
  const current = selected ?? list.data?.[0]?.id;
  return (
    <div className="st-split">
      <aside className="st-list" aria-label="Series">
        <div className="st-list-head">
          <h2>Series</h2>
        </div>
        <form
          className="st-row st-pad"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const id = uniqueId(slug(title), (list.data ?? []).map((s) => s.id));
            await api.putJson(`${SERIES}${id}.json`, { id, title: title.trim(), synopsis: "" } satisfies SeriesJson);
            setTitle("");
            list.reload();
            go("series", id);
          }}
        >
          <input type="text" aria-label="New series" placeholder="New series title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="st-button">Add</button>
        </form>
        <ul>
          {list.data?.map((s) => (
            <li key={s.id}>
              <a href={href("series", s.id)} aria-current={s.id === current ? "page" : undefined} className="st-list-item">
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </aside>
      {current ? (
        <SeriesEditor key={current} id={current} episodes={(stories.data ?? []).filter((s) => s.series?.id === current)} onChange={list.reload} />
      ) : (
        <p className="st-page st-muted">A series groups episodes. Spin-offs are their own series whose first story carries on from another.</p>
      )}
    </div>
  );
}

function SeriesEditor({ id, episodes, onChange }: { id: string; episodes: Array<{ id: string; title: string; series?: { episode: number } }>; onChange: () => void }) {
  const [s, setS] = useDraft<SeriesJson>(`${SERIES}${id}.json`);
  if (!s) return <p className="st-page st-muted">Loading…</p>;
  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>{s.title}</h2>
      </header>
      <section className="st-card">
        <Text label="Title" value={s.title} onChange={(title) => { setS({ ...s, title }); onChange(); }} />
        <LongText label="About the series" value={s.synopsis} onChange={(synopsis) => setS({ ...s, synopsis })} />
      </section>
      <section className="st-card">
        <h3>Episodes</h3>
        {!episodes.length && <p className="st-muted">No stories in this series yet: pick the series in a story's Overview.</p>}
        <ol className="st-plain">
          {[...episodes].sort((a, b) => (a.series?.episode ?? 0) - (b.series?.episode ?? 0)).map((e) => (
            <li key={e.id}>
              Ep {e.series?.episode} · <a href={href("story", e.id)}>{e.title}</a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
