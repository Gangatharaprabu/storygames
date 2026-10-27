import type { Catalog } from "@storygames/pack-spec";
import { SeriesCard } from "../components/Browse.tsx";
import { StoryCard } from "../components/StoryCard.tsx";
import { packUrl } from "../data/catalog.ts";
import { NotFound } from "./NotFound.tsx";

export function Character({ catalog, id }: { catalog: Catalog; id: string }) {
  const character = catalog.characters.find((c) => c.id === id);
  if (!character) return <NotFound what="That character" />;

  const stories = character.stories.map((sid) => catalog.stories.find((s) => s.id === sid)!).filter(Boolean);
  const series = catalog.series.filter((s) => s.stories.some((sid) => character.stories.includes(sid)));
  const lead = stories.filter((s) => s.cast.some((c) => c.id === id && c.role === "protagonist")).length;

  return (
    <article className="character-page">
      <header className="character-head" style={{ ["--character" as string]: character.color }}>
        <img src={packUrl(character.portrait)} alt="" />
        <div>
          <p className="kicker">Character</p>
          <h1>{character.name}</h1>
          <p className="muted">
            In {stories.length} {stories.length === 1 ? "story" : "stories"}
            {lead > 0 && ` · the lead in ${lead}`}
          </p>
        </div>
      </header>
      {character.bio && <p className="synopsis">{character.bio}</p>}

      {series.length > 0 && (
        <section className="row" aria-labelledby="character-series">
          <h2 id="character-series">Series</h2>
          <div className="row-cards row-cards-static">
            {series.map((s) => (
              <SeriesCard key={s.id} catalog={catalog} series={s} />
            ))}
          </div>
        </section>
      )}

      <section className="row" aria-labelledby="character-stories">
        <h2 id="character-stories">Stories with {character.name}</h2>
        <div className="grid">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      </section>
    </article>
  );
}
