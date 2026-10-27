import { useEffect, useRef, useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { StoryCard } from "../components/StoryCard.tsx";
import { allTags, searchStories } from "../data/search.ts";
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
  const toggle = (t: string) => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <section className="page">
      <h1 className="page-title">Search</h1>
      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          ref={input}
          type="search"
          placeholder="Stories, characters, moods…"
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
      <p className="muted" role="status">
        {results.length === 0 ? "No stories match." : `${results.length} ${results.length === 1 ? "story" : "stories"}`}
      </p>
      <div className="grid">
        {results.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>
      {results.length === 0 && (
        <button type="button" className="btn" onClick={() => { setQuery(""); setTags([]); navigate(href.search(), { replace: true }); }}>
          Clear search
        </button>
      )}
    </section>
  );
}
