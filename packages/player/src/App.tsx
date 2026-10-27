import { AppShell } from "./components/AppShell.tsx";
import { Home } from "./pages/Home.tsx";
import { Library } from "./pages/Library.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { Play } from "./pages/Play.tsx";
import { Profile } from "./pages/Profile.tsx";
import { Search } from "./pages/Search.tsx";
import { StoryDetail } from "./pages/StoryDetail.tsx";
import { useRoute } from "./router.ts";
import { useCatalog } from "./state.ts";

export function App() {
  const route = useRoute();
  const catalog = useCatalog();

  if (catalog.status === "loading") return <div className="loading" aria-label="Loading" />;
  if (catalog.status === "error") {
    return (
      <section className="page empty">
        <h1 className="page-title">Can't reach the stories</h1>
        <p className="muted">{catalog.message}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>Try again</button>
      </section>
    );
  }
  const c = catalog.catalog;

  // Playing takes over the whole screen.
  if (route.name === "play") return <Play key={route.id} catalog={c} id={route.id} />;

  return (
    <AppShell route={route}>
      {route.name === "home" && <Home catalog={c} />}
      {route.name === "search" && <Search catalog={c} q={route.q} />}
      {route.name === "library" && <Library catalog={c} />}
      {route.name === "profile" && <Profile catalog={c} />}
      {route.name === "story" && <StoryDetail key={route.id} catalog={c} id={route.id} />}
      {route.name === "not-found" && <NotFound />}
    </AppShell>
  );
}
