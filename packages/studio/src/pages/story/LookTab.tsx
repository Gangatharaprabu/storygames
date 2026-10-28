import { Color, FilePicker, Num, Text } from "../../components/fields.tsx";
import { DEFAULT_THEME, type ThemeJson } from "../../drafts.ts";
import { useDraft } from "../../state.tsx";
import { useStory } from "./context.tsx";

const COLORS: Array<[keyof ThemeJson["colors"], string]> = [
  ["background", "Background"],
  ["surface", "Panels (dialogue, puzzles)"],
  ["text", "Text"],
  ["muted", "Quiet text"],
  ["accent", "Accent (buttons, highlights)"],
  ["accentText", "Text on accent"],
];

const FONTS: Array<[string, string]> = [
  ["system-ui, sans-serif", "Clean (system)"],
  ["Georgia, 'Times New Roman', serif", "Storybook (serif)"],
  ["'Trebuchet MS', system-ui, sans-serif", "Friendly"],
  ["'Courier New', monospace", "Typewriter"],
];

export function LookTab() {
  const { root } = useStory();
  const [theme, setTheme] = useDraft<ThemeJson>(`${root}theme.json`);
  const t = theme ?? DEFAULT_THEME;
  const set = (patch: Partial<ThemeJson>) => setTheme({ ...t, ...patch });
  const sounds = t.sounds ?? {};
  const fonts = t.fonts ?? { body: "system-ui, sans-serif", display: "system-ui, sans-serif" };

  return (
    <div className="st-page">
      <header className="st-page-head">
        <h2>Look & sound</h2>
        <p className="st-muted">Dialogue boxes, buttons and puzzle screens are drawn in these colours, so every story feels like itself.</p>
      </header>
      <section className="st-card st-grid-2">
        <div>
          {COLORS.map(([k, label]) => (
            <Color key={k} label={label} value={t.colors[k]} onChange={(v) => set({ colors: { ...t.colors, [k]: v } })} />
          ))}
        </div>
        <div>
          <div className="st-theme-preview" style={{ background: t.colors.background, color: t.colors.text, fontFamily: fonts.body }}>
            <div style={{ background: t.colors.surface, borderColor: t.colors.accent, borderRadius: t.radius }}>
              <p style={{ fontFamily: fonts.display, color: t.colors.accent, fontWeight: 700, margin: 0 }}>Mira</p>
              <p style={{ margin: "6px 0" }}>If I miss the ferry tonight, I miss everything.</p>
              <p style={{ color: t.colors.muted, fontStyle: "italic", margin: 0 }}>The last light is leaving the harbour.</p>
            </div>
            <button type="button" style={{ background: t.colors.accent, color: t.colors.accentText, borderRadius: t.radius }}>
              Try it
            </button>
          </div>
          <label className="st-field">
            <span className="st-label">Text font</span>
            <select value={fonts.body} onChange={(e) => set({ fonts: { ...fonts, body: e.target.value } })}>
              {FONTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!FONTS.some(([v]) => v === fonts.body) && <option value={fonts.body}>{fonts.body}</option>}
            </select>
          </label>
          <label className="st-field">
            <span className="st-label">Names and titles font</span>
            <select value={fonts.display} onChange={(e) => set({ fonts: { ...fonts, display: e.target.value } })}>
              {FONTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!FONTS.some(([v]) => v === fonts.display) && <option value={fonts.display}>{fonts.display}</option>}
            </select>
          </label>
          <Num label="Corner roundness" value={t.radius ?? 16} min={0} max={40} onChange={(radius) => set({ radius })} />
          <Text label="Colour grade (CSS filter over every scene)" value={t.colorGrade} onChange={(colorGrade) => set({ colorGrade: colorGrade || undefined })} hint="e.g. saturate(1.1) or sepia(0.2): helps art from different sources match." />
        </div>
      </section>
      <section className="st-card st-grid-3">
        <FilePicker label="Tap sound" kind="audio" root={root} folder="audio/" value={sounds.tap} onChange={(tap) => set({ sounds: { ...sounds, tap } })} clearable />
        <FilePicker label="Solved sound" kind="audio" root={root} folder="audio/" value={sounds.solve} onChange={(solve) => set({ sounds: { ...sounds, solve } })} clearable />
        <FilePicker label="Wrong answer sound" kind="audio" root={root} folder="audio/" value={sounds.wrong} onChange={(wrong) => set({ sounds: { ...sounds, wrong } })} clearable />
      </section>
      <section className="st-card">
        <FilePicker label="Dialogue box frame (optional art)" root={root} folder="art/" name="dialogue-frame" value={t.dialogueFrame} onChange={(dialogueFrame) => set({ dialogueFrame })} clearable />
      </section>
    </div>
  );
}
