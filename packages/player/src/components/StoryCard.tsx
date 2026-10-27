import type { ReactNode } from "react";
import type { CatalogEntry } from "@storygames/pack-spec";
import { packUrl } from "../data/catalog.ts";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";
import { SectionTitle } from "./AppShell.tsx";
import { Icon } from "./Icon.tsx";

export function storyMeta(story: CatalogEntry) {
  const parts = [];
  if (story.series) parts.push(`Ep ${story.series.episode}`);
  parts.push(`${story.estimatedMinutes} min`);
  return parts.join(" · ");
}

/**
 * A story as a poster. `overlay`: title on the art (rows); otherwise title under it (grids).
 */
export function StoryCard({ story, overlay = false }: { story: CatalogEntry; overlay?: boolean }) {
  const { progress, saved } = useProfile();
  const p = progress[story.id];
  return (
    <a className={overlay ? "poster poster-overlay" : "poster"} href={href.story(story.id)} data-story={story.id}>
      <div className="poster-art">
        <img src={packUrl(story.cover)} alt="" loading="lazy" />
        {p?.status === "finished" && (
          <span className="poster-badge" aria-label="Finished">
            <Icon name="check" size={14} />
          </span>
        )}
        {story.id in saved && (
          <span className="poster-saved" aria-label="Saved">
            <Icon name="heart" filled size={14} />
          </span>
        )}
        {overlay && (
          <span className="poster-caption">
            <span className="poster-title">{story.title}</span>
            <span className="poster-meta">{storyMeta(story)}</span>
          </span>
        )}
        {p?.status === "playing" && (
          <span className="progress" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <span style={{ width: `${Math.max(4, p.percent)}%` }} />
          </span>
        )}
      </div>
      {!overlay && (
        <span className="poster-text">
          <span className="poster-title">{story.title}</span>
          <span className="poster-meta">{storyMeta(story)}</span>
        </span>
      )}
    </a>
  );
}

/** Wide "continue watching" card: art with time left, and a thin progress line underneath. */
export function ContinueCard({ story }: { story: CatalogEntry }) {
  const { progress } = useProfile();
  const p = progress[story.id];
  const percent = p?.percent ?? 0;
  const left = Math.max(1, Math.round(story.estimatedMinutes * (1 - percent / 100)));
  return (
    <a className="continue" href={href.story(story.id)} data-story={story.id}>
      <div className="continue-art">
        <img src={packUrl(story.cover)} alt="" loading="lazy" />
        <span className="continue-caption">
          <span className="continue-left">{left} min left</span>
          <span className="continue-title">{story.title}</span>
        </span>
      </div>
      <span className="progress-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <span style={{ width: `${Math.max(3, percent)}%` }} />
      </span>
    </a>
  );
}

/** A titled row of poster cards that scrolls sideways. */
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
  titleHref?: string;
  note?: ReactNode;
}) {
  if (!stories.length) return null;
  return (
    <section className="section" aria-labelledby={id}>
      <SectionTitle id={id} title={title} to={titleHref} />
      {note && <p className="section-note">{note}</p>}
      <div className="rail">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} overlay />
        ))}
      </div>
    </section>
  );
}
