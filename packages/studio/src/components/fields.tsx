import { useId, useRef, useState, type ReactNode } from "react";
import { ACCEPT_AUDIO, ACCEPT_IMAGE, prepareUpload, type PreparedFile } from "../files.ts";
import { slug } from "../drafts.ts";
import { forgetFileUrl, useFileUrl, useStudio } from "../state.tsx";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="st-field">
      <span className="st-label">{label}</span>
      {children}
      {hint && <span className="st-hint">{hint}</span>}
    </label>
  );
}

export function Text({ label, value, onChange, hint, placeholder, required }: { label: string; value: string | undefined; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string; required?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <input type="text" value={value ?? ""} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function LongText({ label, value, onChange, hint, rows = 3, placeholder }: { label: string; value: string | undefined; onChange: (v: string) => void; hint?: ReactNode; rows?: number; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Num({ label, value, onChange, min, max, step, hint }: { label: string; value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={value ?? ""} min={min} max={max} step={step} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} />
    </Field>
  );
}

export function Choice<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T | undefined; options: Array<T | [T, string]>; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value as T)}>
        {value === undefined && <option value="">Choose…</option>}
        {options.map((o) => {
          const [v, text] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {text}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <label className="st-check">
      <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <span className="st-color">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#888888"} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </Field>
  );
}

/** Uploads a file into `root` + `folder`, returning its path relative to root (e.g. art/harbour-k2.webp). */
export async function uploadFile(api: ReturnType<typeof useStudio>["api"], root: string, folder: string, file: File, name?: string): Promise<{ path: string; prepared: PreparedFile }> {
  const prepared = await prepareUpload(file);
  const base = slug(name ?? file.name.replace(/\.[^.]+$/, ""));
  const path = `${folder}${base}-${Math.random().toString(36).slice(2, 6)}${prepared.ext}`;
  await api.put(root + path, prepared.body);
  forgetFileUrl(root + path);
  return { path, prepared };
}

/**
 * An image (or sound) of the story or a character: shows it, and replaces it with an upload.
 * `value` is relative to `root`.
 */
export function FilePicker({
  label,
  root,
  folder,
  value,
  onChange,
  kind = "image",
  hint,
  name,
  onPrepared,
  clearable,
}: {
  label: string;
  root: string;
  folder: string;
  value: string | undefined;
  onChange: (path: string | undefined) => void;
  kind?: "image" | "audio";
  hint?: ReactNode;
  name?: string;
  onPrepared?: (p: PreparedFile) => void;
  clearable?: boolean;
}) {
  const { api } = useStudio();
  const url = useFileUrl(value ? root + value : undefined);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const id = useId();
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const { path, prepared } = await uploadFile(api, root, folder, file, name);
      onPrepared?.(prepared);
      onChange(path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="st-field">
      <span className="st-label" id={id}>
        {label}
      </span>
      <div
        className={`st-file st-file-${kind}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void pick(e.dataTransfer.files[0]);
        }}
      >
        {kind === "image" ? (
          <div className="st-file-thumb">{url ? <img src={url} alt="" /> : <span>{value ? "…" : "No picture"}</span>}</div>
        ) : value && url ? (
          <audio controls src={url} />
        ) : (
          <span className="st-muted">{value ? "…" : "No sound"}</span>
        )}
        <div className="st-file-actions">
          <button type="button" className="st-button" aria-labelledby={id} onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : value ? "Replace…" : "Upload…"}
          </button>
          {clearable && value && (
            <button type="button" className="st-button st-quiet" onClick={() => onChange(undefined)}>
              Remove
            </button>
          )}
          <input ref={input} type="file" hidden accept={kind === "image" ? ACCEPT_IMAGE : ACCEPT_AUDIO} data-testid={`upload-${label}`} onChange={(e) => void pick(e.target.files?.[0])} />
        </div>
      </div>
      {error && <span className="st-error">{error}</span>}
      {hint && <span className="st-hint">{hint}</span>}
    </div>
  );
}

/** Small image from the bucket. */
export function Thumb({ fileKey, className, alt = "" }: { fileKey: string | undefined; className?: string; alt?: string }) {
  const url = useFileUrl(fileKey);
  return url ? <img className={className} src={url} alt={alt} /> : <span className={`${className ?? ""} st-thumb-empty`} />;
}

/** A list of short strings (tags, hints) edited as chips. */
export function StringList({ label, values, onChange, placeholder, hint }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: ReactNode }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <Field label={label} hint={hint}>
      <span className="st-chips">
        {values.map((v) => (
          <span key={v} className="st-chip">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={(e) => { e.preventDefault(); onChange(values.filter((x) => x !== v)); }}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </span>
    </Field>
  );
}
