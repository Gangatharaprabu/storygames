import { useEffect, useState } from "react";

/**
 * Hash routes (`#/story/the-last-ferry`), so any link works on static hosting
 * (GitHub Pages, a CDN, inside the native app) without server rewrites.
 */
export type Route =
  | { name: "home" }
  | { name: "search"; q: string }
  | { name: "library" }
  | { name: "profile" }
  | { name: "story"; id: string }
  | { name: "series"; id: string }
  | { name: "character"; id: string }
  | { name: "play"; id: string }
  | { name: "not-found" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case undefined:
      return { name: "home" };
    case "search":
      return { name: "search", q: params.get("q") ?? "" };
    case "library":
      return { name: "library" };
    case "profile":
      return { name: "profile" };
    case "story":
      return parts[1] ? { name: "story", id: parts[1] } : { name: "not-found" };
    case "series":
      return parts[1] ? { name: "series", id: parts[1] } : { name: "not-found" };
    case "character":
      return parts[1] ? { name: "character", id: parts[1] } : { name: "not-found" };
    case "play":
      return parts[1] ? { name: "play", id: parts[1] } : { name: "not-found" };
    default:
      return { name: "not-found" };
  }
}

export const href = {
  home: () => "#/",
  search: (q = "") => (q ? `#/search?q=${encodeURIComponent(q)}` : "#/search"),
  library: () => "#/library",
  profile: () => "#/profile",
  story: (id: string) => `#/story/${encodeURIComponent(id)}`,
  play: (id: string) => `#/play/${encodeURIComponent(id)}`,
  series: (id: string) => `#/series/${encodeURIComponent(id)}`,
  character: (id: string) => `#/character/${encodeURIComponent(id)}`,
};

/** A full link to a story, for sharing. */
export const shareUrl = (id: string) => `${location.href.split("#")[0]}${href.story(id)}`;

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", to);
  else location.hash = to;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
