import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SaveData } from "@storygames/engine";
import type { ProfileData } from "./profile.ts";
import type { Remote } from "./sync.ts";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Accounts are available only when the app was built with the Supabase settings. */
export const accountsEnabled = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | undefined;
/** Loaded on demand, so players who never sign in don't download it. */
export function supabase(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return client;
}

/** The player's data in Supabase (tables in supabase/migrations). */
export function supabaseRemote(sb: SupabaseClient, user: User): Remote {
  const uid = user.id;
  const check = <T extends { error: unknown }>(r: T) => {
    if (r.error) throw r.error;
    return r;
  };
  return {
    async loadState() {
      const r = check(await sb.from("player_state").select("data").eq("user_id", uid).maybeSingle());
      return (r.data?.data as ProfileData | undefined) ?? undefined;
    },
    async saveState(data) {
      const now = new Date().toISOString();
      check(await sb.from("player_state").upsert({ user_id: uid, data, updated_at: now }));
      check(await sb.from("profiles").upsert({ id: uid, name: data.profile.name, avatar: data.profile.avatar, updated_at: now }));
    },
    async loadSaves() {
      const r = check(await sb.from("game_saves").select("data").eq("user_id", uid));
      return (r.data ?? []).map((row) => row.data as SaveData);
    },
    async saveGame(save) {
      check(await sb.from("game_saves").upsert({ user_id: uid, story_id: save.packId, data: save, saved_at: save.savedAt }));
    },
    async deleteGame(storyId) {
      check(await sb.from("game_saves").delete().eq("user_id", uid).eq("story_id", storyId));
    },
  };
}
