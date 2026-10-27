import type { Catalog, CatalogCharacter, CatalogSeries } from "@storygames/pack-spec";
import { packUrl, parentSeriesOf } from "../data/catalog.ts";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";
import { SectionTitle } from "./AppShell.tsx";

/** A character's face and name, linking to their page. */
export function CharacterLink({ character, role }: { character: Pick<CatalogCharacter, "id" | "name" | "portrait">; role?: string }) {
  return (
    <a className="character" href={href.character(character.id)} data-character={character.id}>
      <img src={packUrl(character.portrait)} alt="" loading="lazy" />
      <span className="character-name">{character.name}</span>
      {role && <span className="character-role">{role}</span>}
    </a>
  );
}

export function CharacterRow({ characters, title = "Characters", id = "characters" }: { characters: CatalogCharacter[]; title?: string; id?: string }) {
  if (!characters.length) return null;
  return (
    <section className="section" aria-labelledby={id}>
      <SectionTitle id={id} title={title} />
      <div className="characters">
        {characters.map((c) => (
          <CharacterLink key={c.id} character={c} />
        ))}
      </div>
    </section>
  );
}

/** "Spin-off of Mira's Journey" style line for a series that branched from another. */
export function BranchNote({ catalog, series }: { catalog: Catalog; series: CatalogSeries }) {
  const parents = parentSeriesOf(catalog, series);
  if (!parents.length) return null;
  return (
    <span className="branch-note">
      ↳ Continues from{" "}
      {parents.map(({ story, series: s }, i) => (
        <span key={story.id}>
          {i > 0 && ", "}
          <a href={s ? href.series(s.id) : href.story(story.id)}>{s ? s.title : story.title}</a>
        </span>
      ))}
    </span>
  );
}

/** A series as a poster: first episode's art, title, episode count and your progress. */
export function SeriesCard({ catalog, series }: { catalog: Catalog; series: CatalogSeries }) {
  const { progress } = useProfile();
  const first = catalog.stories.find((s) => s.id === series.stories[0]);
  const done = series.stories.filter((id) => progress[id]?.status === "finished" || (progress[id]?.timesFinished ?? 0) > 0).length;
  const count = series.stories.length;
  return (
    <a className="poster poster-overlay poster-wide" href={href.series(series.id)} data-series={series.id}>
      <div className="poster-art">
        {first && <img src={packUrl(first.cover)} alt="" loading="lazy" />}
        <span className="poster-caption">
          <span className="poster-title">{series.title}</span>
          <span className="poster-meta">
            {count} {count === 1 ? "episode" : "episodes"}
            {done > 0 && ` · ${done} finished`}
          </span>
        </span>
      </div>
    </a>
  );
}
