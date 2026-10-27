/**
 * Where the app reads stories from.
 *
 * - "local" (default; `pnpm dev`, GitHub Pages): packs built next to the app, packs/catalog.json
 * - "published" (Cloudflare): stories published to R2, served at VITE_CONTENT_BASE (/content/),
 *   one catalog per channel. Testers open the site with ?channel=staging to see stories
 *   that aren't live yet (it sticks for the browser tab; ?channel=live switches back).
 */
const env = import.meta.env;
const STAGING_KEY = "sg:channel";

export const contentMode = (): "local" | "published" => (env.VITE_CONTENT_MODE === "published" ? "published" : "local");

let chosen: "live" | "staging" | undefined;
export function channel(): "live" | "staging" {
  if (contentMode() === "local") return "live";
  if (chosen) return chosen;
  const asked = new URLSearchParams(location.search).get("channel");
  try {
    if (asked === "staging" || asked === "live") sessionStorage.setItem(STAGING_KEY, asked);
    const kept = sessionStorage.getItem(STAGING_KEY);
    if (kept === "staging" || kept === "live") return (chosen = kept);
  } catch {
    if (asked === "staging" || asked === "live") return (chosen = asked);
  }
  return (chosen = env.VITE_CHANNEL === "staging" ? "staging" : "live");
}

/** Root that every path in the catalog is relative to. */
export const contentRoot = () =>
  new URL(contentMode() === "published" ? (env.VITE_CONTENT_BASE ?? "/content/") : "packs/", location.href.split("#")[0]).href;

export const catalogPath = () => (contentMode() === "published" ? `catalogs/${channel()}.json` : "catalog.json");
