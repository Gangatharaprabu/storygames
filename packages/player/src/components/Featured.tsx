import { useRef, useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { packUrl } from "../data/catalog.ts";
import { href } from "../router.ts";

interface Slide {
  key: string;
  to: string;
  cover: string;
  kicker: string;
  title: string;
  text: string;
}

/** Big poster carousel: every series, then standalone stories. Neighbours peek in from the sides. */
export function Featured({ catalog }: { catalog: Catalog }) {
  const slides: Slide[] = [
    ...catalog.series.map((s) => {
      const first = catalog.stories.find((x) => x.id === s.stories[0]);
      return {
        key: `series-${s.id}`,
        to: href.series(s.id),
        cover: first?.cover ?? "",
        kicker: `Series · ${s.stories.length} ${s.stories.length === 1 ? "episode" : "episodes"}`,
        title: s.title,
        text: s.synopsis || first?.synopsis || "",
      };
    }),
    ...catalog.stories
      .filter((s) => !s.series)
      .map((s) => ({ key: s.id, to: href.story(s.id), cover: s.cover, kicker: `Story · ${s.estimatedMinutes} min`, title: s.title, text: s.synopsis })),
  ];
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    cards.forEach((c, i) => {
      if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best]!.offsetLeft + cards[best]!.offsetWidth / 2 - mid)) best = i;
    });
    setActive(best);
  };

  if (!slides.length) return null;
  return (
    <section className="featured" aria-label="Featured">
      <div className="featured-track" ref={track} onScroll={onScroll}>
        {slides.map((s, i) => (
          <a key={s.key} className="featured-card" href={s.to} aria-current={i === active ? "true" : undefined}>
            <img src={packUrl(s.cover)} alt="" />
            <span className="featured-caption">
              <span className="featured-kicker">{s.kicker}</span>
              <span className="featured-title">{s.title}</span>
              <span className="featured-text">{s.text}</span>
            </span>
          </a>
        ))}
      </div>
      <div className="dots" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.key} className={i === active ? "dot dot-active" : "dot"} />
        ))}
      </div>
    </section>
  );
}
