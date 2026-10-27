import type { ReactNode } from "react";
import type { CatalogEntry } from "@storygames/pack-spec";
import { packUrl } from "../data/catalog.ts";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";

export function storyMeta(story: CatalogEntry) {
  const parts = [];
  if (story.series) parts.push(`Episode ${story.series.episode}`);
  parts.push(`${story.estimatedMinutes} min`);
  return parts.join(" · ");
}

export function StoryCard({ story, wide = false }: { story: CatalogEntry; wide?: boolean }) {
  const { progress, saved } = useProfile();
  const p = progress[story.id];
  return (
    <a className={wide ? "card card-wide" : "card"} href={href.story(story.id)} data-story={story.id}>
      <div className="card-art">
        <img src={packUrl(story.cover)} alt="" loading="lazy" />
        {p?.status === "finished" && <span className="card-badge">✓ Finished</span>}
        {story.id in saved && <span className="card-saved" aria-label="Saved">♥</span>}
        {p?.status === "playing" && (
          <span className="progress" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <span style={{ width: `${Math.max(4, p.percent)}%` }} />
          </span>
        )}
      </div>
      <div className="card-text">
        <span className="card-title">{story.title}</span>
        <span className="card-meta">{storyMeta(story)}</span>
      </div>
    </a>
  );
}

/** A titled row of cards: scrolls sideways on phones, wraps into a grid on wide screens. */
export function StoryRow({
  title,
  stories,
  id,
  titleHref,
  note,
}: {
  title: string;
  stories: CatalogEntry[];
  id?: string;
  /** Makes the heading a link (e.g. to the series page). */
  titleHref?: string;
  note?: ReactNode;
}) {
  if (!stories.length) return null;
  return (
    <section className="row" aria-labelledby={id}>
      <h2 id={id}>
        {titleHref ? (
          <a className="row-link" href={titleHref}>
            {title} <span aria-hidden="true">›</span>
          </a>
        ) : (
          title
        )}
      </h2>
      {note && <p className="row-note">{note}</p>}
      <div className="row-cards">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </div>
    </section>
  );
}
