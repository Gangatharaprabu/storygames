import type { ReactNode } from "react";
import { channel } from "../config.ts";
import { href, navigate, type Route } from "../router.ts";
import { useProfile } from "../state.ts";
import { Icon, type IconName } from "./Icon.tsx";

const TABS: Array<{ route: Route["name"]; label: string; icon: IconName; to: string }> = [
  { route: "home", label: "Home", icon: "home", to: href.home() },
  { route: "search", label: "Search", icon: "search", to: href.search() },
  { route: "library", label: "My stories", icon: "library", to: href.library() },
  { route: "profile", label: "Profile", icon: "profile", to: href.profile() },
];

/** Top bar + a floating, icons-only tab bar. */
/** Pages you reach by tapping into something get a back button instead of the logo. */
const DETAIL: Array<Route["name"]> = ["story", "series", "character", "not-found"];

let visited = 0;
window.addEventListener("hashchange", () => visited++);

function goBack() {
  // Back within the app; a shared link opened fresh has nowhere to go back to, so go home.
  if (visited > 0) history.back();
  else navigate(href.home());
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const { profile } = useProfile();
  const detail = DETAIL.includes(route.name);
  return (
    <div className="app">
      <header className="app-header">
        {detail ? (
          <button type="button" className="icon-btn" aria-label="Back" onClick={goBack}>
            <Icon name="back" />
          </button>
        ) : (
          <a className="app-logo" href={href.home()}>
            Storygames
          </a>
        )}
        {channel() === "staging" && (
          <span className="staging-badge" title="You're seeing stories that aren't live yet">Staging</span>
        )}
        <a className="icon-btn" href={href.profile()} aria-label={`Profile: ${profile.name}`}>
          <span className="app-avatar" aria-hidden="true">{profile.avatar}</span>
        </a>
      </header>
      <main className="app-main">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => {
          const active = route.name === t.route;
          return (
            <a key={t.route} href={t.to} aria-label={t.label} aria-current={active ? "page" : undefined}>
              <Icon name={t.icon} filled={active && t.icon !== "search"} size={28} />
            </a>
          );
        })}
      </nav>
    </div>
  );
}

/** "Top trending ›" style section heading; the chevron links somewhere when `to` is given. */
export function SectionTitle({ id, title, to }: { id?: string; title: string; to?: string }) {
  return (
    <h2 className="section-title" id={id}>
      {to ? (
        <a href={to}>
          {title} <Icon name="chevron" size={18} />
        </a>
      ) : (
        title
      )}
    </h2>
  );
}
