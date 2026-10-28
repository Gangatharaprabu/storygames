import type { Catalog } from "@storygames/pack-spec";
import { SectionTitle } from "../components/AppShell.tsx";
import { BranchNote, CharacterRow } from "../components/Browse.tsx";
import { Featured } from "../components/Featured.tsx";
import { ContinueCard, StoryRow } from "../components/StoryCard.tsx";
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
      <h1 className="greeting">{hasPlayed ? `Welcome back, ${profile.name}` : `Hello, ${profile.name}`}</h1>
      {stories.length === 0 && (
        <div className="empty">
          <p>No stories here yet. New ones are on their way.</p>
        </div>
      )}
      <Featured catalog={catalog} />

      {continuing.length > 0 && (
        <section className="section" aria-labelledby="continue">
          <SectionTitle id="continue" title="Continue" to={href.library()} />
          <div className="rail rail-wide">
            {continuing.map((s) => (
              <ContinueCard key={s.id} story={s} />
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
