import { useEffect, useRef, useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { CharacterLink, SeriesCard } from "../components/Browse.tsx";
import { StoryCard } from "../components/StoryCard.tsx";
import { allTags, searchCharacters, searchSeries, searchStories } from "../data/search.ts";
import { href, navigate } from "../router.ts";

export function Search({ catalog, q }: { catalog: Catalog; q: string }) {
  const [query, setQuery] = useState(q);
  const [tags, setTags] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  // Keep the query in the URL (shareable, survives back/forward) without new history entries.
  useEffect(() => {
    const to = href.search(query);
    if (location.hash !== to) history.replaceState(null, "", to);
  }, [query]);

  const results = searchStories(catalog.stories, query, tags);
  // Characters and series only for typed searches (tags describe stories).
  const characters = tags.length ? [] : searchCharacters(catalog.characters, query);
  const series = tags.length ? [] : searchSeries(catalog.series, query);
  const nothing = !results.length && !characters.length && !series.length;
  const toggle = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <section className="page">
      <h1 className="page-title">Search</h1>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          ref={input}
          type="search"
          placeholder="Stories, characters, series, moods…"
          aria-label="Search stories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <div className="chips" role="group" aria-label="Filter by tag">
        {allTags(catalog.stories).map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
      </div>
      {characters.length > 0 && (
        <>
          <h2>Characters</h2>
          <div className="characters">
            {characters.map((c) => (
              <CharacterLink key={c.id} character={c} />
            ))}
          </div>
        </>
      )}
      {series.length > 0 && (
        <>
          <h2>Series</h2>
          <div className="row-cards row-cards-static">
            {series.map((s) => (
              <SeriesCard key={s.id} catalog={catalog} series={s} />
            ))}
          </div>
        </>
      )}
      {(characters.length > 0 || series.length > 0) && <h2>Stories</h2>}
      <p className="muted" role="status">
        {nothing ? "Nothing matches." : results.length === 0 ? "No stories match." : `${results.length} ${results.length === 1 ? "story" : "stories"}`}
      </p>
      <div className="grid">
        {results.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>
      {nothing && (
        <button type="button" className="btn" onClick={() => { setQuery(""); setTags([]); navigate(href.search(), { replace: true }); }}>
          Clear search
        </button>
      )}
    </section>
  );
}
