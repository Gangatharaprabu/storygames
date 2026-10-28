import { useState } from "react";
import { Thumb } from "../components/fields.tsx";
import { createStory, listStories, storyRoot, type StoryJson } from "../drafts.ts";
import { go, href } from "../router.ts";
import { useAsync, useDraft, useStudio } from "../state.tsx";

export function Stories() {
  const { api } = useStudio();
  const stories = useAsync(() => listStories(api), []);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <div className="st-page st-wide">
      <header className="st-page-head">
        <h1>Stories</h1>
        <button type="button" className="st-button st-primary" onClick={() => setCreating(true)}>
          + New story
        </button>
      </header>
      {creating && (
        <form
          className="st-card st-row st-align-end"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const id = await createStory(api, title.trim());
            go("story", id);
          }}
        >
          <label className="st-field st-grow">
            <span className="st-label">Title</span>
            <input autoFocus type="text" value={title} placeholder="The Last Ferry" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button className="st-button st-primary">Create</button>
          <button type="button" className="st-button st-quiet" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}
      {stories.error && <p className="st-error">{stories.error}</p>}
      {stories.data && !stories.data.length && !creating && (
        <div className="st-empty">
          <p>No stories yet.</p>
          <p className="st-muted">Start one: you'll get a first scene and a first line of dialogue to build on.</p>
        </div>
      )}
      <ul className="st-story-grid">
        {stories.data?.map((s) => <StoryTile key={s.id} id={s.id} />)}
      </ul>
    </div>
  );
}

function StoryTile({ id }: { id: string }) {
  const [story] = useDraft<StoryJson>(`${storyRoot(id)}story.json`);
  return (
    <li>
      <a className="st-story-tile" href={href("story", id)}>
        <StoryCover id={id} story={story} />
        <span className="st-story-tile-text">
          {story?.series && <span className="st-kicker">{story.series.title} · Ep {story.series.episode}</span>}
          <strong>{story?.title ?? id}</strong>
          <span className="st-muted st-small">v{story?.version}</span>
        </span>
      </a>
    </li>
  );
}

function StoryCover({ id, story }: { id: string; story: StoryJson | undefined }) {
  const [scene] = useDraft<{ background: string }>(story && !story.cover ? `${storyRoot(id)}scenes/${story.startScene}.json` : undefined);
  const path = story?.cover ?? scene?.background;
  return <Thumb fileKey={path ? storyRoot(id) + path : undefined} className="st-poster" />;
}
