import type { Catalog } from "@storygames/pack-spec";
import { StoryCard, StoryRow } from "../components/StoryCard.tsx";
import { useProfile } from "../state.ts";

export function Home({ catalog }: { catalog: Catalog }) {
  const { profile, progress } = useProfile();
  const stories = catalog.stories;

  const continuing = stories
    .filter((s) => progress[s.id]?.status === "playing")
    .sort((a, b) => progress[b.id]!.lastPlayedAt.localeCompare(progress[a.id]!.lastPlayedAt));

  const series = new Map<string, { title: string; stories: typeof stories }>();
  for (const s of stories) {
    if (!s.series) continue;
    const entry = series.get(s.series.id) ?? { title: s.series.title, stories: [] };
    entry.stories.push(s);
    series.set(s.series.id, entry);
  }
  const standalone = stories.filter((s) => !s.series);
  const hasPlayed = Object.keys(progress).length > 0;

  return (
    <>
      <section className="hero">
        <p className="hero-kicker">{hasPlayed ? `Welcome back, ${profile.name}` : `Hello, ${profile.name}`}</p>
        <h1>Short stories you solve.</h1>
        <p className="hero-sub">Five-minute journeys, puzzles and people along the way.</p>
      </section>

      {continuing.length > 0 && (
        <section className="row" aria-labelledby="continue">
          <h2 id="continue">Continue</h2>
          <div className="row-cards">
            {continuing.map((s) => (
              <StoryCard key={s.id} story={s} wide />
            ))}
          </div>
        </section>
      )}

      {[...series].map(([id, s]) => (
        <StoryRow key={id} id={`series-${id}`} title={s.title} stories={s.stories} />
      ))}
      <StoryRow id="standalone" title="Short stories" stories={standalone} />
    </>
  );
}
