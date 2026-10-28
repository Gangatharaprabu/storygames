import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadSave, onSaveChange, writeSave } from "../storage.ts";
import type { ProfileStore } from "./profile.ts";
import { accountsEnabled, supabase, supabaseRemote } from "./supabase.ts";
import { CloudSync, type SyncStatus } from "./sync.ts";

export interface AccountState {
  /** The app was built with Supabase settings. */
  enabled: boolean;
  /** Sign-in state is known (false while checking an existing session). */
  ready: boolean;
  email?: string;
  sync: SyncStatus;
}

/**
 * Optional account: guests play exactly as before; signing in (email code or link) syncs
 * the profile, library and saves across devices.
 */
export class Account {
  state: AccountState = { enabled: accountsEnabled, ready: !accountsEnabled, sync: "idle" };
  private listeners = new Set<() => void>();
  private sync?: CloudSync;
  private userId?: string;
  private sb?: SupabaseClient;

  constructor(private store: ProfileStore) {}

  get = () => this.state;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  /** Connect now if this device was signed in before (or is returning from an email link). */
  async resume() {
    if (!accountsEnabled) return;
    const hasSession = Object.keys(safeLocalStorage()).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    const fromEmailLink = new URLSearchParams(location.search).has("code");
    if (hasSession || fromEmailLink) await this.connect();
    else this.set({ ready: true });
  }

  /** Step 1: email a 6-digit code (and a sign-in link) to the player. */
  async sendCode(email: string) {
    const sb = await this.connect();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: location.href.split("?")[0]!.split("#")[0] + "#/profile" },
    });
    if (error) throw new Error(friendly("send", error.message));
  }

  /** Step 2: the code from the email. */
  async verifyCode(email: string, code: string) {
    const sb = await this.connect();
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) throw new Error(friendly("verify", error.message));
  }

  /** Sign out. Everything stays on this device; it just stops syncing. */
  async signOut() {
    await this.sync?.flush();
    await this.sb?.auth.signOut();
  }

  private async connect(): Promise<SupabaseClient> {
    if (this.sb) return this.sb;
    const sb = await supabase();
    this.sb = sb;
    sb.auth.onAuthStateChange((_event, session) => {
      // Supabase asks not to await its own calls inside this callback.
      setTimeout(() => void this.onUser(session?.user ?? null), 0);
    });
    const { data } = await sb.auth.getSession();
    await this.onUser(data.session?.user ?? null);
    if (new URLSearchParams(location.search).has("code")) {
      history.replaceState(null, "", location.pathname + location.hash); // tidy the email-link URL
    }
    return sb;
  }

  private async onUser(user: User | null) {
    if (user?.id === this.userId) {
      this.set({ ready: true, email: user?.email });
      return;
    }
    this.sync?.stop();
    this.sync = undefined;
    this.userId = user?.id;
    this.set({ ready: true, email: user?.email, sync: "idle" });
    if (!user || !this.sb) return;

    const sync = new CloudSync(this.store, supabaseRemote(this.sb, user), {
      load: loadSave,
      write: (save) => writeSave(save, { notify: false }),
      onChange: onSaveChange,
    });
    sync.onStatus = (s) => this.set({ sync: s });
    this.sync = sync;
    await sync.start();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && this.sync === sync) void sync.flush();
    });
  }

  private set(patch: Partial<AccountState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}

function safeLocalStorage(): Storage | Record<string, never> {
  try {
    return localStorage;
  } catch {
    return {};
  }
}

/** Player-friendly wording for the common cases; anything else is shown as Supabase said it. */
export function friendly(step: "send" | "verify", message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many tries. Please wait a minute and try again.";
  if (/fetch|network|load failed/i.test(message)) return "Can't reach the server. Check your connection.";
  if (step === "verify" && /expired|invalid|not found/i.test(message)) {
    return "That code didn't work. It may have expired: send a new one.";
  }
  if (/api key|apikey|jwt/i.test(message)) return `Sign-in isn't set up correctly (the app's Supabase key was rejected: ${message}).`;
  return step === "send" ? `Couldn't send the code: ${message}` : `Couldn't sign in: ${message}`;
}
