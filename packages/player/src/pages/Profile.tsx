import { useState } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { AccountPanel } from "../components/AccountPanel.tsx";
import { AVATARS } from "../data/profile.ts";
import { href } from "../router.ts";
import { profileStore, useProfile } from "../state.ts";
import { clearSave } from "../storage.ts";

export function Profile({ catalog }: { catalog: Catalog }) {
  const data = useProfile();
  const { profile, progress, saved } = data;
  const [name, setName] = useState(profile.name);
  const [picking, setPicking] = useState(false);

  const all = Object.values(progress);
  const finished = all.filter((p) => p.status === "finished" || p.timesFinished > 0).length;
  const playing = all.filter((p) => p.status === "playing").length;
  const minutes = Math.round(all.reduce((t, p) => t + p.secondsPlayed, 0) / 60);
  const finishedStories = catalog.stories
    .filter((s) => progress[s.id]?.finishedAt)
    .sort((a, b) => progress[b.id]!.finishedAt!.localeCompare(progress[a.id]!.finishedAt!));

  const reset = () => {
    if (!window.confirm("Reset all progress? Saved and finished stories will be cleared (on all your devices, if you're signed in).")) return;
    catalog.stories.forEach((s) => clearSave(s.id));
    profileStore.resetAll();
  };

  return (
    <section className="page profile">
      <div className="profile-head">
        <button
          type="button"
          className="avatar-big"
          aria-label="Change avatar"
          aria-expanded={picking}
          onClick={() => setPicking(!picking)}
        >
          {profile.avatar}
        </button>
        <form
          className="profile-name"
          onSubmit={(e) => {
            e.preventDefault();
            profileStore.rename(name);
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <label htmlFor="name" className="muted">Your name</label>
          <input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => profileStore.rename(name)} />
        </form>
      </div>
      {picking && (
        <div className="avatars" role="group" aria-label="Avatars">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={a === profile.avatar}
              onClick={() => {
                profileStore.setAvatar(a);
                setPicking(false);
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      <section className="account-card" aria-labelledby="account">
        <h2 id="account">Account</h2>
        <AccountPanel />
      </section>

      <dl className="stats">
        <div><dt>Finished</dt><dd>{finished}</dd></div>
        <div><dt>In progress</dt><dd>{playing}</dd></div>
        <div><dt>Saved</dt><dd>{Object.keys(saved).length}</dd></div>
        <div><dt>Minutes played</dt><dd>{minutes}</dd></div>
      </dl>

      <h2>Finished stories</h2>
      {finishedStories.length ? (
        <ul className="finished">
          {finishedStories.map((s) => (
            <li key={s.id}>
              <a href={href.story(s.id)}>{s.title}</a>
              <span className="muted">{new Date(progress[s.id]!.finishedAt!).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">None yet. Your first one is about five minutes away.</p>
      )}

      <h2>Your data</h2>
      <button type="button" className="btn btn-danger" onClick={reset}>Reset all progress</button>
    </section>
  );
}
