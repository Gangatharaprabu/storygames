import type { CastMember } from "@storygames/pack-spec";
import type { z } from "zod";
import { Check, Choice, FilePicker, LongText, Num, StringList, Text, Thumb } from "../../components/fields.tsx";
import { readChannel } from "@storygames/builder";
import { useState } from "react";
import { apiStore } from "../../api.ts";
import { characterRoot, deleteStory, listSeries, listStories } from "../../drafts.ts";
import { go, href } from "../../router.ts";
import { useAsync, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

type Member = z.input<typeof CastMember>;

export function OverviewTab() {
  const { api } = useStudio();
  const { story, setStory, root, scenes, library, cast } = useStory();
  const series = useAsync(() => listSeries(api), []);
  const stories = useAsync(() => listStories(api), []);
  const set = (patch: Partial<typeof story>) => setStory({ ...story, ...patch });
  const members = story.cast ?? [];
  const setMember = (i: number, m: Member) => set({ cast: members.map((x, j) => (j === i ? m : x)) });
  const others = (stories.data ?? []).filter((s) => s.id !== story.id);

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>Overview</h2>
        <p className="st-muted">What players see when browsing, and who's in it.</p>
      </header>

      <section className="st-card st-grid-2">
        <div>
          <Text label="Title" value={story.title} onChange={(title) => set({ title })} />
          <LongText label="Synopsis" value={story.synopsis} onChange={(synopsis) => set({ synopsis })} rows={4} hint="One or two sentences for the story page." />
          <StringList label="Tags" values={story.tags ?? []} onChange={(tags) => set({ tags })} placeholder="cosy, mystery… (Enter to add)" />
          <div className="st-row">
            <Num label="Minutes to play" value={story.estimatedMinutes} min={1} max={60} onChange={(estimatedMinutes) => set({ estimatedMinutes })} />
            <Choice label="First scene" value={story.startScene} options={scenes.map((s) => [s.id, s.title ?? s.id] as [string, string])} onChange={(startScene) => set({ startScene })} />
          </div>
          <p className="st-hint">
            Story id <code>{story.id}</code> · version <code>{story.version}</code> (set when publishing)
          </p>
        </div>
        <FilePicker label="Cover (poster)" root={root} folder="art/" name="cover" value={story.cover} onChange={(cover) => set({ cover })} clearable hint="Portrait picture shown in the app. Without one, the first scene's background is used." />
      </section>

      <section className="st-card">
        <h3>Series</h3>
        <Check
          label="Part of a series"
          value={Boolean(story.series)}
          onChange={(on) => set({ series: on ? { id: series.data?.[0]?.id ?? "my-series", title: series.data?.[0]?.title ?? "My series", episode: 1 } : undefined })}
        />
        {story.series && (
          <div className="st-row">
            <Choice
              label="Series"
              value={story.series.id}
              options={[...(series.data ?? []).map((s) => [s.id, s.title] as [string, string]), ...((series.data ?? []).some((s) => s.id === story.series!.id) ? [] : [[story.series.id, story.series.title] as [string, string]])]}
              onChange={(id) => set({ series: { ...story.series!, id, title: series.data?.find((s) => s.id === id)?.title ?? id } })}
              hint={<a href={href("series")}>Manage series</a>}
            />
            <Num label="Episode" value={story.series.episode} min={1} onChange={(episode) => set({ series: { ...story.series!, episode } })} />
          </div>
        )}
        <Field2 label="Carries on from" hint="Earlier episodes, or the story a spin-off branches from.">
          <span className="st-chips">
            {others.map((s) => (
              <label key={s.id} className="st-check">
                <input
                  type="checkbox"
                  checked={(story.follows ?? []).includes(s.id)}
                  onChange={(e) => set({ follows: e.target.checked ? [...(story.follows ?? []), s.id] : (story.follows ?? []).filter((x) => x !== s.id) })}
                />
                <span>{s.title}</span>
              </label>
            ))}
            {!others.length && <span className="st-muted">No other stories yet.</span>}
          </span>
        </Field2>
      </section>

      <section className="st-card">
        <h3>Cast</h3>
        <p className="st-muted">
          Characters come from the <a href={href("characters")}>character library</a>, so the same character can appear in many stories.
        </p>
        <ul className="st-cast">
          {members.map((m, i) => {
            const lib = library.find((c) => c.id === m.character);
            const variants = lib ? Object.keys(lib.variants) : [];
            const shown = cast.find((c) => c.character.id === m.character);
            const portrait = lib?.variants[m.variant ?? "default"]?.portraits[lib.variants[m.variant ?? "default"]!.defaultExpression];
            return (
              <li key={m.character} className="st-cast-member">
                <Thumb fileKey={portrait ? characterRoot(m.character) + portrait : undefined} className="st-avatar" />
                <div>
                  <strong>{lib?.name ?? m.character}</strong>
                  <span className="st-muted"> {shown ? `${shown.expressions.length} expressions` : lib ? "" : "(not in the library)"}</span>
                </div>
                {variants.length > 1 && (
                  <select aria-label="Look" value={m.variant ?? "default"} onChange={(e) => setMember(i, { ...m, variant: e.target.value })}>
                    {variants.map((v) => <option key={v}>{v}</option>)}
                  </select>
                )}
                <select aria-label="Role" value={m.role ?? "npc"} onChange={(e) => setMember(i, { ...m, role: e.target.value as Member["role"] })}>
                  <option value="protagonist">Main character</option>
                  <option value="npc">Supporting</option>
                </select>
                <button type="button" className="st-icon" aria-label={`Remove ${lib?.name ?? m.character}`} onClick={() => set({ cast: members.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        <select
          className="st-add"
          aria-label="Add to cast"
          value=""
          onChange={(e) => {
            const c = library.find((x) => x.id === e.target.value);
            if (c) set({ cast: [...members, { character: c.id, variant: Object.keys(c.variants)[0] ?? "default", role: members.length ? "npc" : "protagonist" }] });
          }}
        >
          <option value="">+ Add a character…</option>
          {library.filter((c) => !members.some((m) => m.character === c.id)).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </section>

      <DeleteStory />
    </div>
  );
}

function Field2({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="st-field">
      <span className="st-label">{label}</span>
      {children}
      {hint && <span className="st-hint">{hint}</span>}
    </div>
  );
}

/** Deletes the story's drafts, once it's off staging and live. */
function DeleteStory() {
  const { api, drafts } = useStudio();
  const { id, root, story } = useStory();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const store = apiStore(api);
      const [staging, live] = await Promise.all([readChannel(store, "staging"), readChannel(store, "live")]);
      const on = [live.stories[id] && "live", staging.stories[id] && "staging"].filter(Boolean);
      if (on.length) {
        setError(`It's still on ${on.join(" and ")}. Take it off there first (Publish tab), then delete it.`);
        return;
      }
      if (prompt(`This deletes “${story.title}” from the Studio for good: scenes, dialogue, art, everything.\n\nType DELETE to confirm.`) !== "DELETE") return;
      await drafts.flush().catch(() => {});
      await deleteStory(api, id);
      drafts.forget(root);
      go();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="st-card st-danger-zone">
      <h3>Delete this story</h3>
      <p className="st-muted">Removes it from the Studio. Characters stay in the library. Versions you published stay stored but unseen once the story is off staging and live.</p>
      <button type="button" className="st-button st-danger" disabled={busy} onClick={() => void remove()}>
        {busy ? "Deleting…" : "Delete story…"}
      </button>
      {error && <p className="st-error">{error}</p>}
    </section>
  );
}
