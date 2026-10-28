import { useEffect, useMemo, useState } from "react";
import { ApiError, StudioApi } from "./api.ts";
import { accessToken, sendCode, signInRequired, signOut, verifyCode } from "./auth.ts";
import { Characters } from "./pages/Characters.tsx";
import { SeriesPage } from "./pages/Series.tsx";
import { Stories } from "./pages/Stories.tsx";
import { StoryEditor } from "./pages/story/StoryEditor.tsx";
import { href, useRoute } from "./router.ts";
import { Drafts, StudioContext, type Studio } from "./state.tsx";

export function App() {
  const api = useMemo(() => new StudioApi(accessToken), []);
  const [who, setWho] = useState<{ email: string } | { error: string; status: number } | null>(null);
  const check = () =>
    api.me().then(setWho, (e: Error) => setWho({ error: e.message, status: e instanceof ApiError ? e.status : 0 }));
  useEffect(() => void check(), []);

  if (!who) return <p className="st-center st-muted">Opening the Studio…</p>;
  if ("error" in who) {
    if (who.status === 401 && signInRequired) return <SignIn onDone={check} />;
    return (
      <div className="st-center">
        <h1>Storygames Studio</h1>
        <p className="st-error">{who.error}</p>
        {signInRequired && (
          <button type="button" className="st-button" onClick={() => void signOut().then(check)}>
            Sign in with another email
          </button>
        )}
      </div>
    );
  }
  return <Signed studio={{ api, drafts: new Drafts(api), email: who.email }} onSignOut={() => void signOut().then(check)} />;
}

function Signed({ studio, onSignOut }: { studio: Studio; onSignOut: () => void }) {
  const [state] = useState(studio);
  const route = useRoute();
  const [page, a, b, c] = route;
  return (
    <StudioContext.Provider value={state}>
      <div className="st-app">
        <header className="st-top">
          <a className="st-logo" href={href()}>
            Storygames <span>Studio</span>
          </a>
          <nav aria-label="Studio">
            <a href={href()} aria-current={!page || page === "story" ? "page" : undefined}>Stories</a>
            <a href={href("characters")} aria-current={page === "characters" ? "page" : undefined}>Characters</a>
            <a href={href("series")} aria-current={page === "series" ? "page" : undefined}>Series</a>
          </nav>
          <span className="st-who">
            {state.email}
            {signInRequired && (
              <button type="button" className="st-link" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </span>
        </header>
        <div className="st-body">
          {!page && <Stories />}
          {page === "story" && a && <StoryEditor key={a} id={a} tab={b} item={c} />}
          {page === "characters" && <Characters selected={a} />}
          {page === "series" && <SeriesPage selected={a} />}
        </div>
      </div>
    </StudioContext.Provider>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="st-center">
      <h1>Storygames Studio</h1>
      <p className="st-muted">Sign in with the email you use in the Storygames app.</p>
      {!sent ? (
        <form className="st-signin" onSubmit={(e) => { e.preventDefault(); void run(async () => { await sendCode(email.trim()); setSent(true); }); }}>
          <input type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <button className="st-button st-primary" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
        </form>
      ) : (
        <form className="st-signin" onSubmit={(e) => { e.preventDefault(); void run(async () => { await verifyCode(email.trim(), code.trim()); onDone(); }); }}>
          <p>We sent an email to {email}. Type the code from it, or open its link in this browser.</p>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Code" />
          <button className="st-button st-primary" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="st-link" onClick={() => setSent(false)}>Use another email</button>
        </form>
      )}
      {error && <p className="st-error">{error}</p>}
    </div>
  );
}
