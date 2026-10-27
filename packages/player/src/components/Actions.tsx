import { useState } from "react";
import type { CatalogEntry } from "@storygames/pack-spec";
import { shareUrl } from "../router.ts";
import { profileStore, useProfile } from "../state.ts";

export function SaveButton({ story }: { story: CatalogEntry }) {
  const { saved } = useProfile();
  const isSaved = story.id in saved;
  return (
    <button type="button" className="btn" aria-pressed={isSaved} onClick={() => profileStore.toggleSaved(story.id)}>
      <span aria-hidden="true">{isSaved ? "♥" : "♡"}</span> {isSaved ? "Saved" : "Save"}
    </button>
  );
}

/** Shares a link to the story: the phone's share sheet when there is one, otherwise copies the link. */
export function ShareButton({ story, className = "btn" }: { story: CatalogEntry; className?: string }) {
  const [note, setNote] = useState("");
  const share = async () => {
    const url = shareUrl(story.id);
    const data = { title: story.title, text: `${story.title}: ${story.synopsis}`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      window.prompt("Copy this link to share the story:", url);
    }
    setTimeout(() => setNote(""), 2500);
  };
  return (
    <span className="share">
      <button type="button" className={className} onClick={share}>
        <span aria-hidden="true">↗</span> Share
      </button>
      <span className="toast" role="status">{note}</span>
    </span>
  );
}
