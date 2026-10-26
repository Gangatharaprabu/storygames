import type { CSSProperties } from "react";
import type { Theme } from "@storygames/pack-spec";

/** Turns a story theme into CSS variables. All player UI and puzzle views read only these. */
export function themeVars(theme: Theme, assetUrl: (path: string) => string): CSSProperties {
  const c = theme.colors;
  return {
    "--sg-bg": c.background,
    "--sg-surface": c.surface,
    "--sg-text": c.text,
    "--sg-muted": c.muted,
    "--sg-accent": c.accent,
    "--sg-accent-text": c.accentText,
    "--sg-font-body": theme.fonts.body,
    "--sg-font-display": theme.fonts.display,
    "--sg-radius": `${theme.radius}px`,
    "--sg-grade": theme.colorGrade ?? "none",
    "--sg-dialogue-frame": theme.dialogueFrame ? `url(${assetUrl(theme.dialogueFrame)})` : "none",
  } as CSSProperties;
}
