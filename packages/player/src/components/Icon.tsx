/** Line icons (24×24, drawn with currentColor). */
const PATHS = {
  home: "M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z",
  stories: "M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 14.5zM10 8.2v4.6l4-2.3zM8 20h8",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20",
  library: "M5 9h14v10.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5zM6.5 6h11M8 3.5h8",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  share: "M12 15V4M8 8l4-4 4 4M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12",
  play: "M8 5.5v13l10.5-6.5z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  bookmark: "M6.5 4h11v16l-5.5-4-5.5 4z",
  check: "M5 12.5 10 17.5 19 7",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  restart: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, filled = false, size = 22 }: { name: IconName; filled?: boolean; size?: number }) {
  return (
    <svg className={filled ? "icon icon-filled" : "icon"} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
