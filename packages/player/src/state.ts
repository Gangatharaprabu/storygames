import { useEffect, useState, useSyncExternalStore } from "react";
import type { Catalog } from "@storygames/pack-spec";
import { SoundBoard } from "@storygames/ui";
import { loadCatalog } from "./data/catalog.ts";
import { Account } from "./data/account.ts";
import { localBackend, ProfileStore } from "./data/profile.ts";

/** One profile per device for now; swap the backend for cloud accounts later. */
export const profileStore = new ProfileStore(localBackend());
export const sound = new SoundBoard();
/** Optional sign-in that syncs the profile store across devices. */
export const account = new Account(profileStore);
void account.resume();

const params = new URLSearchParams(location.search);
/** Author tools: always on in `pnpm dev`, and on any build with `?debug` in the URL. */
export const debugEnabled = import.meta.env.DEV || params.has("debug");

export function useAccount() {
  return useSyncExternalStore(account.subscribe, account.get);
}

export function useProfile() {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get);
}

export type CatalogState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; catalog: Catalog };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((catalog) => live && setState({ status: "ready", catalog }))
      .catch((e: Error) => live && setState({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
