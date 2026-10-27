import type { Catalog } from "@storygames/pack-spec";
import { SaveButton, ShareButton } from "../components/Actions.tsx";
import { SectionTitle } from "../components/AppShell.tsx";
import { CharacterLink } from "../components/Browse.tsx";
import { Hero } from "../components/Hero.tsx";
import { Icon } from "../components/Icon.tsx";
import { StoryCard, storyMeta } from "../components/StoryCard.tsx";
import { continuationsOf, episodesOf } from "../data/catalog.ts";
import { href, navigate } from "../router.ts";
import { profileStore, useProfile } from "../state.ts";
import { clearSave, loadSave } from "../storage.ts";
import { NotFound } from "./NotFound.tsx";

export function StoryDetail({ catalog, id }: { catalog: Catalog; id: string }) {
  const { progress } = useProfile();
  const story = catalog.stories.find((s) => s.id === id);
  if (!story) return <NotFound what="That story" />;

  const p = progress[story.id];
  const hasSave = Boolean(loadSave(story.id)) && p?.status === "playing";
  const episodes = episodesOf(catalog.stories, story);
  const next = continuationsOf(catalog.stories, story.id);
  const earlier = story.continuesFrom
    .map((sid) => catalog.stories.find((s) => s.id === sid))
    .filter((s) => s && progress[s.id]?.status !== "finished");

  const startOver = () => {
    if (hasSave && !window.confirm("Start over? Your progress in this story will be lost.")) return;
    clearSave(story.id);
    profileStore.abandon(story.id);
    navigate(href.play(story.id));
  };

  return (
    <article className="detail">
      <Hero
        cover={story.cover}
        title={story.title}
        kicker={
          story.series && (
            <>
              <a href={href.series(story.series.id)}>{story.series.title}</a> · Episode {story.series.episode}
            </>
          )
        }
        meta={
          <>
            {storyMeta(story)}
            {p?.status === "finished" && " · Finished"}
            {p?.status === "playing" && ` · ${p.percent}% done`}
          </>
        }
      >
        <div className="actions">
          {hasSave ? (
            <a className="btn btn-primary" href={href.play(story.id)}>
              <Icon name="play" filled size={18} /> Continue
            </a>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startOver}>
              <Icon name="play" filled size={18} /> {p?.status === "finished" ? "Play again" : "Play"}
            </button>
          )}
          {hasSave && (
            <button type="button" className="round-btn" onClick={startOver} aria-label="Start over" title="Start over">
              <Icon name="restart" size={20} />
            </button>
          )}
          <SaveButton story={story} />
          <ShareButton story={story} />
        </div>
      </Hero>

      <div className="detail-body">
        <p className="synopsis">{story.synopsis}</p>

        {earlier.length > 0 && (
          <p className="notice">
            Continues from{" "}
            {earlier.map((s, i) => (
              <span key={s!.id}>
                {i > 0 && ", "}
                <a href={href.story(s!.id)}>{s!.title}</a>
              </span>
            ))}
            . Play that first for the full story, or jump right in.
          </p>
        )}

        {story.tags.length > 0 && (
          <div className="chips">
            {story.tags.map((t) => (
              <a key={t} className="chip" href={href.search(t)}>{t}</a>
            ))}
          </div>
        )}

        <section className="section">
          <SectionTitle title="Characters" />
          <div className="characters">
            {story.cast.map((c) => (
              <CharacterLink key={c.id} character={c} role={c.role === "protagonist" ? "Lead" : undefined} />
            ))}
          </div>
        </section>

        {next.length > 0 && (
          <section className="section">
            <SectionTitle title="What happens next" />
            <div className="grid">
              {next.map((n) => (
                <div key={n.id} className="next">
                  {n.series && n.series.id !== story.series?.id && (
                    <a className="next-label" href={href.series(n.series.id)}>
                      New series: {n.series.title}
                    </a>
                  )}
                  <StoryCard story={n} />
                </div>
              ))}
            </div>
          </section>
        )}

        {episodes.length > 1 && (
          <section className="section">
            <SectionTitle title={story.series!.title} to={href.series(story.series!.id)} />
            <ol className="episodes">
              {episodes.map((e) => (
                <li key={e.id} aria-current={e.id === story.id ? "true" : undefined}>
                  <a href={href.story(e.id)}>
                    <span className="episode-num">{e.series!.episode}</span>
                    <span>{e.title}</span>
                    <span className="muted">{progress[e.id]?.status === "finished" ? "✓" : `${e.estimatedMinutes} min`}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </article>
  );
}
