import { useState } from "react";
import { Color, FilePicker, LongText, Text, Thumb } from "../components/fields.tsx";
import { characterRoot, createCharacter, deleteCharacter, listCharacters, storiesWith, type CharacterJson } from "../drafts.ts";
import { go, href } from "../router.ts";
import { useAsync, useDraft, useStudio } from "../state.tsx";

export function Characters({ selected }: { selected?: string }) {
  const { api } = useStudio();
  const list = useAsync(() => listCharacters(api), []);
  const add = async () => {
    const name = prompt("Character's name");
    if (!name?.trim()) return;
    const id = await createCharacter(api, name.trim());
    list.reload();
    go("characters", id);
  };
  const current = selected ?? list.data?.[0]?.id;
  return (
    <div className="st-split">
      <aside className="st-list" aria-label="Characters">
        <div className="st-list-head">
          <h2>Characters</h2>
          <button type="button" className="st-button" onClick={() => void add()}>
            + New
          </button>
        </div>
        <p className="st-hint st-pad">Characters live outside stories, so they can return in sequels and spin-offs.</p>
        <ul>
          {list.data?.map((c) => {
            const v = Object.values(c.variants)[0];
            const portrait = v?.portraits[v.defaultExpression];
            return (
              <li key={c.id}>
                <a href={href("characters", c.id)} aria-current={c.id === current ? "page" : undefined} className="st-list-item">
                  <Thumb fileKey={portrait ? characterRoot(c.id) + portrait : undefined} className="st-avatar" />
                  <span>{c.name}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </aside>
      {current ? <CharacterEditor key={current} id={current} onRenamed={list.reload} onDeleted={() => { list.reload(); go("characters"); }} /> : <p className="st-page st-muted">No characters yet.</p>}
    </div>
  );
}

function CharacterEditor({ id, onRenamed, onDeleted }: { id: string; onRenamed: () => void; onDeleted: () => void }) {
  const { api, drafts } = useStudio();
  const root = characterRoot(id);
  const [deleteError, setDeleteError] = useState<string>();
  const [c, setC] = useDraft<CharacterJson>(`${root}character.json`);
  const [variant, setVariant] = useState<string>();
  const [expr, setExpr] = useState("");
  if (!c) return <p className="st-page st-muted">Loading…</p>;
  const set = (patch: Partial<CharacterJson>) => setC({ ...c, ...patch });
  const names = Object.keys(c.variants);
  const vName = variant && c.variants[variant] ? variant : names[0]!;
  const v = c.variants[vName]!;
  const setV = (patch: Partial<typeof v>) => set({ variants: { ...c.variants, [vName]: { ...v, ...patch } } });
  const expressions = [...new Set([...Object.keys(v.portraits), ...Object.keys(v.sprites ?? {})])];

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>{c.name}</h2>
        <span className="st-muted">
          id <code>{c.id}</code>
        </span>
      </header>
      <section className="st-card st-grid-2">
        <div>
          <Text label="Name" value={c.name} onChange={(name) => { set({ name }); onRenamed(); }} />
          <Color label="Name colour in dialogue" value={c.color} onChange={(color) => set({ color })} />
        </div>
        <LongText label="About them" value={c.bio} onChange={(bio) => set({ bio })} rows={5} hint="Shown on their page in the app." />
      </section>

      <section className="st-card">
        <div className="st-card-head">
          <h3>Looks</h3>
          <div className="st-row">
            {names.map((n) => (
              <button key={n} type="button" className={`st-pill${n === vName ? " st-on" : ""}`} onClick={() => setVariant(n)}>
                {n}
              </button>
            ))}
            <button
              type="button"
              className="st-link"
              onClick={() => {
                const n = prompt("Name of the new look (e.g. “winter”, “older”)")?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
                if (!n || c.variants[n]) return;
                set({ variants: { ...c.variants, [n]: { ...v } } });
                setVariant(n);
              }}
            >
              + another look
            </button>
          </div>
        </div>
        <p className="st-muted">Each story picks one look. A close-up portrait per expression is needed; full-body art (for standing in scenes) is optional.</p>
        <table className="st-table st-expressions">
          <thead>
            <tr><th>Expression</th><th>Portrait (close-up)</th><th>Full body (optional)</th><th /></tr>
          </thead>
          <tbody>
            {expressions.map((x) => (
              <tr key={x}>
                <td>
                  <label className="st-check">
                    <input type="radio" name="default-expression" checked={v.defaultExpression === x} onChange={() => setV({ defaultExpression: x })} />
                    <span>{x}</span>
                  </label>
                </td>
                <td>
                  <FilePicker label={`${x} portrait`} root={root} folder="portraits/" name={x} value={v.portraits[x]} onChange={(p) => setV({ portraits: p ? { ...v.portraits, [x]: p } : Object.fromEntries(Object.entries(v.portraits).filter(([k]) => k !== x)) })} />
                </td>
                <td>
                  <FilePicker label={`${x} full body`} root={root} folder="sprites/" name={x} value={v.sprites?.[x]} clearable onChange={(p) => setV({ sprites: p ? { ...v.sprites, [x]: p } : Object.fromEntries(Object.entries(v.sprites ?? {}).filter(([k]) => k !== x)) })} />
                </td>
                <td>
                  {x !== v.defaultExpression && (
                    <button
                      type="button"
                      className="st-icon"
                      aria-label={`Remove ${x}`}
                      onClick={() => setV({ portraits: Object.fromEntries(Object.entries(v.portraits).filter(([k]) => k !== x)), sprites: Object.fromEntries(Object.entries(v.sprites ?? {}).filter(([k]) => k !== x)) })}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="st-row"
          onSubmit={(e) => {
            e.preventDefault();
            const name = expr.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
            if (!name || expressions.includes(name)) return;
            setV({ portraits: { ...v.portraits, [name]: v.portraits[v.defaultExpression]! } });
            setExpr("");
          }}
        >
          <input type="text" aria-label="New expression" placeholder="happy, worried, surprised…" value={expr} onChange={(e) => setExpr(e.target.value)} />
          <button className="st-button">Add expression</button>
        </form>
        <p className="st-hint">A new expression starts with a copy of the default portrait: replace it with the right one. Keep every portrait the same size and framing.</p>
      </section>

      <section className="st-card st-danger-zone">
        <h3>Delete {c.name}</h3>
        <button
          type="button"
          className="st-button st-danger"
          onClick={async () => {
            setDeleteError(undefined);
            const used = await storiesWith(api, id);
            if (used.length) return setDeleteError(`${c.name} is in ${used.join(", ")}. Take them out of the cast first (story → Overview).`);
            if (!confirm(`Delete ${c.name} and all their pictures from the library?`)) return;
            await deleteCharacter(api, id);
            drafts.forget(root);
            onDeleted();
          }}
        >
          Delete character…
        </button>
        {deleteError && <p className="st-error">{deleteError}</p>}
      </section>
    </div>
  );
}
