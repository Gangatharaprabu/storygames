import type { Catalog } from "@storygames/pack-spec";
import { SectionTitle } from "../components/AppShell.tsx";
import { BranchNote, CharacterLink, SeriesCard } from "../components/Browse.tsx";
import { Hero } from "../components/Hero.tsx";
import { Icon } from "../components/Icon.tsx";
import { StoryCard } from "../components/StoryCard.tsx";
import { spinOffsOf } from "../data/catalog.ts";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";
import { NotFound } from "./NotFound.tsx";

export function Series({ catalog, id }: { catalog: Catalog; id: string }) {
  const { progress } = useProfile();
  const series = catalog.series.find((s) => s.id === id);
  if (!series) return <NotFound what="That series" />;

  const episodes = series.stories.map((sid) => catalog.stories.find((s) => s.id === sid)!).filter(Boolean);
  const first = episodes[0];
  const next = episodes.find((e) => progress[e.id]?.status !== "finished") ?? first;
  const minutes = episodes.reduce((t, e) => t + e.estimatedMinutes, 0);
  const cast = catalog.characters.filter((c) => c.stories.some((sid) => series.stories.includes(sid)));
  const spinOffs = spinOffsOf(catalog, series);

  return (
    <article className="detail">
      <Hero
        cover={first?.cover}
        kicker="Series"
        title={series.title}
        meta={`${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"} · ${minutes} min in all`}
      >
        <BranchNote catalog={catalog} series={series} />
        {next && (
          <div className="actions">
            <a className="btn btn-primary" href={href.story(next.id)}>
              <Icon name="play" filled size={18} />
              {progress[next.id] ? `Continue with episode ${next.series?.episode}` : `Start with episode ${next.series?.episode}`}
            </a>
          </div>
        )}
      </Hero>

      <div className="detail-body">
        {series.synopsis && <p className="synopsis">{series.synopsis}</p>}

        <section className="section">
          <SectionTitle title="Episodes" />
          <div className="grid">
            {episodes.map((e) => (
              <StoryCard key={e.id} story={e} />
            ))}
          </div>
        </section>

        <section className="section">
          <SectionTitle title="Characters" />
          <div className="characters">
            {cast.map((c) => (
              <CharacterLink key={c.id} character={c} />
            ))}
          </div>
        </section>

        {spinOffs.length > 0 && (
          <section className="section">
            <SectionTitle title="The story continues in" />
            <div className="rail rail-wide">
              {spinOffs.map((s) => (
                <SeriesCard key={s.id} catalog={catalog} series={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
