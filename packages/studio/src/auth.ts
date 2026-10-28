import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Signing in to the hosted Studio: the same Supabase project as the player app, with a
 * one-time code by email. Only emails listed in STUDIO_AUTHORS get past the API.
 * Locally (no VITE_SUPABASE_URL) there's no sign-in: you're the author.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const signInRequired = Boolean(url && key);

let client: Promise<SupabaseClient> | undefined;
function supabase() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!.replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, ""), key!, {
      auth: { persistSession: true, storageKey: "storygames-studio-auth", flowType: "pkce" },
    }),
  );
  return client;
}

export async function accessToken(): Promise<string | undefined> {
  if (!signInRequired) return undefined;
  const { data } = await (await supabase()).auth.getSession();
  return data.session?.access_token;
}

export async function sendCode(email: string) {
  // Only existing accounts (sign in to the app once first). The email has a code and/or a link back here.
  const { error } = await (await supabase()).auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, token: string) {
  const { error } = await (await supabase()).auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (signInRequired) await (await supabase()).auth.signOut();
}
