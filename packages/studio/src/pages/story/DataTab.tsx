import { useState } from "react";
import { parseValue } from "../../components/conditions.tsx";
import { FilePicker } from "../../components/fields.tsx";
import { listStories, slug, uniqueId } from "../../drafts.ts";
import { useAsync, useStudio } from "../../state.tsx";
import { useStory } from "./context.tsx";

export function DataTab() {
  const { api } = useStudio();
  const { story, setStory, root } = useStory();
  const [flag, setFlag] = useState("");
  const [item, setItem] = useState("");
  const stories = useAsync(() => listStories(api), []);
  const flags = story.flags ?? {};
  const items = story.items ?? [];
  const exports = story.exports ?? [];
  const imports = story.imports ?? {};
  const set = (patch: Partial<typeof story>) => setStory({ ...story, ...patch });

  const addFlag = () => {
    const name = flag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f$1");
    if (!name || name in flags) return;
    set({ flags: { ...flags, [name]: false } });
    setFlag("");
  };
  const renameless = (name: string) => {
    const { [name]: _, ...rest } = flags;
    set({ flags: rest, exports: exports.filter((e) => e !== name) });
  };

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>Flags & items</h2>
      </header>

      <section className="st-card">
        <h3>Flags</h3>
        <p className="st-muted">Things the story remembers: “talked_to_tomo”, “coins”. Conditions and dialogue check them; steps set them.</p>
        <table className="st-table">
          <thead>
            <tr><th>Flag</th><th>Starts as</th><th>Carry into sequels</th><th /></tr>
          </thead>
          <tbody>
            {Object.entries(flags).map(([name, value]) => (
              <tr key={name}>
                <td><code>{name}</code></td>
                <td>
                  <input type="text" aria-label={`${name} starts as`} value={String(value)} onChange={(e) => set({ flags: { ...flags, [name]: parseValue(e.target.value) } })} />
                </td>
                <td>
                  <input type="checkbox" aria-label={`Carry ${name} into sequels`} checked={exports.includes(name)} onChange={(e) => set({ exports: e.target.checked ? [...exports, name] : exports.filter((x) => x !== name) })} />
                </td>
                <td>
                  <button type="button" className="st-icon" aria-label={`Delete ${name}`} onClick={() => renameless(name)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="st-row" onSubmit={(e) => { e.preventDefault(); addFlag(); }}>
          <input type="text" aria-label="New flag" placeholder="new_flag_name" value={flag} onChange={(e) => setFlag(e.target.value)} />
          <button className="st-button">Add flag</button>
        </form>
        <p className="st-hint">Values: true / false, a number, or text.</p>
      </section>

      <section className="st-card">
        <h3>From earlier stories</h3>
        <p className="st-muted">Flags carried over from a story the player finished before (e.g. whether they helped someone in episode 1).</p>
        <table className="st-table">
          <thead>
            <tr><th>Flag</th><th>From story</th><th>If they haven't played it</th><th /></tr>
          </thead>
          <tbody>
            {Object.entries(imports).map(([name, imp]) => (
              <tr key={name}>
                <td><code>{name}</code></td>
                <td>
                  <select aria-label={`${name} comes from`} value={imp.from} onChange={(e) => set({ imports: { ...imports, [name]: { ...imp, from: e.target.value } } })}>
                    {(stories.data ?? []).filter((s) => s.id !== story.id).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </td>
                <td>
                  <input type="text" aria-label={`${name} default`} value={String(imp.default)} onChange={(e) => set({ imports: { ...imports, [name]: { ...imp, default: parseValue(e.target.value) } } })} />
                </td>
                <td>
                  <button type="button" className="st-icon" aria-label={`Remove ${name}`} onClick={() => { const { [name]: _, ...rest } = imports; set({ imports: rest }); }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="st-link"
          onClick={() => {
            const name = prompt("Flag name, exactly as the earlier story calls it")?.trim();
            const from = (stories.data ?? []).find((s) => s.id !== story.id)?.id;
            if (name && from) set({ imports: { ...imports, [name]: { from, default: false } } });
          }}
        >
          + bring in a flag
        </button>
      </section>

      <section className="st-card">
        <h3>Items</h3>
        <p className="st-muted">Things the player carries. Shown in the corner of the screen.</p>
        <div className="st-items">
          {items.map((it, i) => (
            <div key={it.id} className="st-item">
              <FilePicker label={`Icon of ${it.name}`} root={root} folder="art/" name={it.id} value={it.icon} onChange={(icon) => icon && set({ items: items.map((x, j) => (j === i ? { ...x, icon } : x)) })} />
              <input type="text" aria-label="Item name" value={it.name} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <code className="st-small">{it.id}</code>
              <button type="button" className="st-link" onClick={() => set({ items: items.filter((_, j) => j !== i) })}>Delete</button>
            </div>
          ))}
        </div>
        <form
          className="st-row"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = item.trim();
            if (!name) return;
            const id = uniqueId(slug(name), items.map((x) => x.id));
            const icon = `art/item-${id}.svg`;
            await api.put(root + icon, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="18" fill="#f2a65a"/><text x="50" y="64" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="700" fill="#1d1a2f">${name[0]!.toUpperCase().replace(/[<&>]/g, "")}</text></svg>`);
            set({ items: [...items, { id, name, icon }] });
            setItem("");
          }}
        >
          <input type="text" aria-label="New item" placeholder="Coil of rope" value={item} onChange={(e) => setItem(e.target.value)} />
          <button className="st-button">Add item</button>
        </form>
      </section>
    </div>
  );
}
