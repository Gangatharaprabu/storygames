import type { Catalog } from "@storygames/pack-spec";
import { BranchNote, CharacterLink, SeriesCard } from "../components/Browse.tsx";
import { StoryCard } from "../components/StoryCard.tsx";
import { packUrl, spinOffsOf } from "../data/catalog.ts";
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
      <div className="detail-art">{first && <img src={packUrl(first.cover)} alt="" />}</div>
      <div className="detail-body">
        <p className="kicker">Series</p>
        <h1>{series.title}</h1>
        <p className="muted">
          {episodes.length} {episodes.length === 1 ? "episode" : "episodes"} · {minutes} min in all
        </p>
        <BranchNote catalog={catalog} series={series} />
        {series.synopsis && <p className="synopsis">{series.synopsis}</p>}
        {next && (
          <div className="actions">
            <a className="btn btn-primary" href={href.story(next.id)}>
              {progress[next.id] ? `Continue with episode ${next.series?.episode}` : `Start with episode ${next.series?.episode}`}
            </a>
          </div>
        )}

        <h2>Episodes</h2>
        <div className="grid">
          {episodes.map((e) => (
            <StoryCard key={e.id} story={e} />
          ))}
        </div>

        <h2>Characters</h2>
        <div className="characters">
          {cast.map((c) => (
            <CharacterLink key={c.id} character={c} />
          ))}
        </div>

        {spinOffs.length > 0 && (
          <>
            <h2>The story continues in</h2>
            <div className="row-cards row-cards-static">
              {spinOffs.map((s) => (
                <SeriesCard key={s.id} catalog={catalog} series={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
