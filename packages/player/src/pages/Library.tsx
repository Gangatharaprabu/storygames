import { useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { Icon, type IconName } from "../components/Icon.tsx";
import { StoryCard } from "../components/StoryCard.tsx";
import { href } from "../router.ts";
import { useProfile } from "../state.ts";

const TABS = [
  { id: "recent", label: "Recently played", icon: "eye" },
  { id: "saved", label: "Saved", icon: "bookmark" },
  { id: "finished", label: "Finished", icon: "check" },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: IconName }>;

export function Library({ catalog }: { catalog: Catalog }) {
  const { saved, progress } = useProfile();
  // Open on what's most useful: recent plays if there are any, else saved stories.
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(() =>
    Object.keys(progress).length ? "recent" : "saved",
  );
  const byId = new Map(catalog.stories.map((s) => [s.id, s]));

  const ids =
    tab === "saved"
      ? Object.entries(saved).sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id)
      : Object.entries(progress)
          .filter(([, p]) => tab === "recent" || p.status === "finished" || p.timesFinished > 0)
          .sort((a, b) => b[1].lastPlayedAt.localeCompare(a[1].lastPlayedAt))
          .map(([id]) => id);
  const stories = ids.map((id) => byId.get(id)).filter((s) => s !== undefined);

  const empty = {
    saved: "Tap ♡ Save on any story to keep it here.",
    recent: "Stories you play will show up here.",
    finished: "Stories you finish are collected here.",
  }[tab];

  return (
    <section className="page">
      <h1 className="page-title">My stories</h1>
      <div className="pills" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="pill" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} /> {t.label}
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
