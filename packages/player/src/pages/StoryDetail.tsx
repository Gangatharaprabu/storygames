import type { Catalog } from "@storygames/pack-spec";
import { SaveButton, ShareButton } from "../components/Actions.tsx";
import { storyMeta } from "../components/StoryCard.tsx";
import { episodesOf, packUrl } from "../data/catalog.ts";
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
      <div className="detail-art">
        <img src={packUrl(story.cover)} alt="" />
      </div>
      <div className="detail-body">
        {story.series && (
          <p className="kicker">
            {story.series.title} · Episode {story.series.episode}
          </p>
        )}
        <h1>{story.title}</h1>
        <p className="muted">
          {storyMeta(story)}
          {p?.status === "finished" && " · ✓ Finished"}
          {p?.status === "playing" && ` · ${p.percent}% done`}
        </p>
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

        <div className="actions">
          {hasSave ? (
            <>
              <a className="btn btn-primary" href={href.play(story.id)}>Continue</a>
              <button type="button" className="btn" onClick={startOver}>Start over</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startOver}>
              {p?.status === "finished" ? "Play again" : "Play"}
            </button>
          )}
          <SaveButton story={story} />
          <ShareButton story={story} />
        </div>

        {story.tags.length > 0 && (
          <div className="chips">
            {story.tags.map((t) => (
              <a key={t} className="chip" href={href.search(t)}>{t}</a>
            ))}
          </div>
        )}

        <h2>Characters</h2>
        <ul className="cast">
          {story.cast.map((c) => (
            <li key={c.id}>
              <img src={packUrl(c.portrait)} alt="" />
              <span>{c.name}</span>
            </li>
          ))}
        </ul>

        {episodes.length > 1 && (
          <>
            <h2>{story.series!.title}</h2>
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
          </>
        )}
      </div>
    </article>
  );
}
