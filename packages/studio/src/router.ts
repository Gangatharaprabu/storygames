import { useEffect, useState } from "react";

/** Hash routes: #/story/the-last-ferry/scenes/harbour → ["story", "the-last-ferry", "scenes", "harbour"] */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const href = (...parts: string[]) => `#/${parts.map(encodeURIComponent).join("/")}`;
export const go = (...parts: string[]) => {
  location.hash = href(...parts);
};
