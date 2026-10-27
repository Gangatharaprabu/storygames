import type { ReactNode } from "react";
import { href, type Route } from "../router.ts";
import { useProfile } from "../state.ts";

/** Simple line icons (24×24, drawn with currentColor) so all tabs match. */
const ICONS = {
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20",
  library: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
};

const TABS = [
  { route: "home", label: "Home", to: href.home() },
  { route: "search", label: "Search", to: href.search() },
  { route: "library", label: "My stories", to: href.library() },
  { route: "profile", label: "Profile", to: href.profile() },
] as const;

/** Header + navigation (top bar on wide screens, bottom tab bar on phones). */
export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { profile } = useProfile();
  return (
    <div className="app">
      <header className="app-header">
        <a className="app-logo" href={href.home()}>
          <span aria-hidden="true">🏮</span> Storygames
        </a>
        <nav className="app-nav-top" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.route} href={t.to} aria-current={route.name === t.route ? "page" : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <a className="app-avatar" href={href.profile()} aria-label={`Profile: ${profile.name}`}>
          {profile.avatar}
        </a>
      </header>
      <main className="app-main">{children}</main>
      <nav className="app-tabs" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.route} href={t.to} aria-current={route.name === t.route ? "page" : undefined}>
            <svg className="app-tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICONS[t.route]} />
            </svg>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
