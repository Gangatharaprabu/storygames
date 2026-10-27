import { useState } from "react";
import { account, useAccount } from "../state.ts";

const STATUS = {
  idle: "",
  syncing: "Syncing…",
  synced: "Synced across your devices",
  offline: "Offline: changes will sync when you're back online",
} as const;

/** Sign in with an emailed code to sync progress across devices. Optional: guests keep playing. */
export function AccountPanel() {
  const state = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!state.enabled) {
    return (
      <p className="muted">
        Your profile and progress are saved on this device. Accounts that sync between your phone and computer are coming.
      </p>
    );
  }
  if (!state.ready) return <p className="muted">Checking your account…</p>;

  if (state.email) {
    return (
      <div className="account">
        <p>
          Signed in as <strong>{state.email}</strong>
        </p>
        {STATUS[state.sync] && (
          <p className={`sync sync-${state.sync}`} role="status">
            {STATUS[state.sync]}
          </p>
        )}
        <button type="button" className="btn" onClick={() => void account.signOut()}>
          Sign out
        </button>
        <p className="muted small">Signing out keeps everything on this device; it just stops syncing.</p>
      </div>
    );
  }

  const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account">
      <p className="muted">
        Sign in to keep your progress, saved stories and choices in sync on all your devices. No password: we email you a
        code.
      </p>
      {step === "email" ? (
        <form
          className="account-form"
          onSubmit={run(async () => {
            await account.sendCode(email.trim());
            setStep("code");
          })}
        >
          <label htmlFor="email" className="muted small">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form className="account-form" onSubmit={run(() => account.verifyCode(email.trim(), code))}>
          <label htmlFor="code" className="muted small">
            Code sent to {email}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="btn-link" onClick={() => { setStep("email"); setCode(""); setError(""); }}>
            Use a different email
          </button>
          <p className="muted small">You can also tap the link in the email.</p>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
