import { useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { StoryCard } from "../components/StoryCard.tsx";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";

const TABS = [
  { id: "saved", label: "Saved" },
  { id: "playing", label: "In progress" },
  { id: "finished", label: "Finished" },
] as const;

export function Library({ catalog }: { catalog: Catalog }) {
  const { saved, progress } = useProfile();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("saved");
  const byId = new Map(catalog.stories.map((s) => [s.id, s]));

  const ids =
    tab === "saved"
      ? Object.entries(saved).sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id)
      : Object.entries(progress)
          .filter(([, p]) => p.status === tab)
          .sort((a, b) => b[1].lastPlayedAt.localeCompare(a[1].lastPlayedAt))
          .map(([id]) => id);
  const stories = ids.map((id) => byId.get(id)).filter((s) => s !== undefined);

  const empty = {
    saved: "Tap ♡ Save on any story to keep it here.",
    playing: "Stories you've started will wait for you here.",
    finished: "Stories you finish are collected here.",
  }[tab];

  return (
    <section className="page">
      <h1 className="page-title">My stories</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {stories.length ? (
        <div className="grid" role="tabpanel">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      ) : (
        <div className="empty" role="tabpanel">
          <p>{empty}</p>
          <a className="btn" href={href.home()}>Browse stories</a>
        </div>
      )}
    </section>
  );
}
