/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTENT_MODE?: "local" | "published";
  readonly VITE_CONTENT_BASE?: string;
  readonly VITE_CHANNEL?: "live" | "staging";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
