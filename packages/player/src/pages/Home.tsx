import type { Catalog } from "@storygames/pack-spec";
import { BranchNote, CharacterRow } from "../components/Browse.tsx";
import { StoryCard, StoryRow } from "../components/StoryCard.tsx";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";

export function Home({ catalog }: { catalog: Catalog }) {
  const { profile, progress } = useProfile();
  const stories = catalog.stories;

  const continuing = stories
    .filter((s) => progress[s.id]?.status === "playing")
    .sort((a, b) => progress[b.id]!.lastPlayedAt.localeCompare(progress[a.id]!.lastPlayedAt));

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

      {catalog.series.map((series) => (
        <StoryRow
          key={series.id}
          id={`series-${series.id}`}
          title={series.title}
          titleHref={href.series(series.id)}
          note={series.branchesFrom.length > 0 && <BranchNote catalog={catalog} series={series} />}
          stories={series.stories.map((id) => stories.find((s) => s.id === id)!).filter(Boolean)}
        />
      ))}
      <CharacterRow characters={catalog.characters} />
      <StoryRow id="standalone" title="Short stories" stories={standalone} />
    </>
  );
}
