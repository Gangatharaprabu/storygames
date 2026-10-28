import { describe, expect, it } from "vitest";
import type { SaveData } from "../packages/engine/src/index.ts";
import { mergeProfiles, newProfile, ProfileStore, type ProfileBackend, type ProfileData } from "../packages/player/src/data/profile.ts";
import { CloudSync, type LocalSaves, type Remote } from "../packages/player/src/data/sync.ts";

const T = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString();
const at = (n: number) => new Date(T(n));

function memoryBackend(): ProfileBackend {
  let d: ProfileData | undefined;
  return { load: () => d && structuredClone(d), save: (x) => void (d = structuredClone(x)) };
}

describe("mergeProfiles", () => {
  it("keeps everything done on either device; the latest decision wins", () => {
    const phone = new ProfileStore(memoryBackend());
    const laptop = new ProfileStore(memoryBackend());
    phone.rename("Ganga", at(5));
    laptop.rename("G", at(3));
    phone.toggleSaved("ferry", at(1));
    laptop.toggleSaved("clocks", at(2));
    laptop.toggleSaved("ferry", at(1)); // saved on laptop too…
    laptop.toggleSaved("ferry", at(4)); // …then un-saved later
    phone.recordProgress("ferry", 40, 60, at(6));
    laptop.finish("lighthouse", { talked_to_hana: true }, at(7));

    const m = mergeProfiles(phone.get(), laptop.get());
    expect(m.profile.name).toBe("Ganga");
    expect(Object.keys(m.saved)).toEqual(["clocks"]);
    expect(m.unsaved?.ferry).toBe(T(4));
    expect(m.progress.ferry).toMatchObject({ status: "playing", percent: 40 });
    expect(m.progress.lighthouse).toMatchObject({ status: "finished", timesFinished: 1 });
    expect(m.saga.lighthouse).toEqual({ talked_to_hana: true });
    // Order doesn't matter.
    expect(mergeProfiles(laptop.get(), phone.get()).saved).toEqual(m.saved);
  });

  it("combines runs of the same story: latest run, best counts", () => {
    const a = new ProfileStore(memoryBackend());
    const b = new ProfileStore(memoryBackend());
    a.recordProgress("ferry", 10, 0, at(1));
    a.finish("ferry", { helped_ferryman: true }, at(2));
    a.addPlaytime("ferry", 300);
    b.recordProgress("ferry", 50, 30, at(3)); // replaying on another device
    const m = mergeProfiles(a.get(), b.get());
    expect(m.progress.ferry).toMatchObject({ status: "playing", percent: 50, timesFinished: 1, finishedAt: T(2), secondsPlayed: 300 });
    expect(m.saga.ferry).toEqual({ helped_ferryman: true });
  });

  it("a reset on one device wins over older data from another", () => {
    const a = new ProfileStore(memoryBackend());
    const b = new ProfileStore(memoryBackend());
    b.toggleSaved("ferry", at(1));
    b.finish("ferry", {}, at(2));
    a.resetAll(at(5));
    a.toggleSaved("clocks", at(6));
    const m = mergeProfiles(b.get(), a.get());
    expect(m.saved).toEqual({ clocks: T(6) });
    expect(m.progress).toEqual({});
    expect(m.resetAt).toBe(T(5));
  });
});

/** A fake account backend shared by "devices". */
function fakeCloud() {
  let state: ProfileData | undefined;
  const saves = new Map<string, SaveData>();
  let online = true;
  const guard = () => {
    if (!online) throw new Error("offline");
  };
  const remote: Remote = {
    async loadState() { guard(); return state && structuredClone(state); },
    async saveState(d) { guard(); state = structuredClone(d); },
    async loadSaves() { guard(); return [...saves.values()].map((s) => structuredClone(s)); },
    async saveGame(s) { guard(); saves.set(s.packId, structuredClone(s)); },
    async deleteGame(id) { guard(); saves.delete(id); },
  };
  return { remote, saves, get state() { return state; }, setOnline: (v: boolean) => (online = v) };
}

function device() {
  const store = new ProfileStore(memoryBackend());
  const local = new Map<string, SaveData>();
  const listeners = new Set<(id: string, s: SaveData | undefined) => void>();
  const saves: LocalSaves = {
    load: (id) => local.get(id),
    write: (s) => void local.set(s.packId, s),
    onChange: (l) => (listeners.add(l), () => listeners.delete(l)),
  };
  const writeSave = (s: SaveData) => {
    local.set(s.packId, s);
    listeners.forEach((l) => l(s.packId, s));
  };
  return { store, local, saves, writeSave };
}

const save = (id: string, n: number): SaveData => ({
  packId: id, packVersion: "1.0.0", savedAt: T(n), ink: "{}",
  state: { scene: "dock", flags: {}, inventory: [], solved: [], hintsUsed: {}, visited: ["dock"], completed: false },
});

describe("CloudSync", () => {
  it("signing in on a second device brings everything across, both ways", async () => {
    const cloud = fakeCloud();
    const phone = device();
    phone.store.rename("Ganga", at(1));
    phone.store.toggleSaved("ferry", at(1));
    phone.writeSave(save("ferry", 2));
    const phoneSync = new CloudSync(phone.store, cloud.remote, phone.saves, 0);
    await phoneSync.start();
    phone.writeSave(save("ferry", 3));
    await phoneSync.flush();
    expect(cloud.saves.get("ferry")?.savedAt).toBe(T(3));

    const laptop = device();
    laptop.store.toggleSaved("clocks", at(4));
    const laptopSync = new CloudSync(laptop.store, cloud.remote, laptop.saves, 0);
    await laptopSync.start();
    expect(laptop.store.get().profile.name).toBe("Ganga");
    expect(Object.keys(laptop.store.get().saved).sort()).toEqual(["clocks", "ferry"]);
    expect(laptop.local.get("ferry")?.savedAt).toBe(T(3)); // continue where the phone left off
    expect(laptopSync.status).toBe("synced");

    // The phone picks up the laptop's change on its next push, instead of overwriting it.
    phone.store.toggleSaved("lighthouse", at(5));
    await phoneSync.flush();
    expect(Object.keys(phone.store.get().saved).sort()).toEqual(["clocks", "ferry", "lighthouse"]);
    expect(Object.keys(cloud.state!.saved).sort()).toEqual(["clocks", "ferry", "lighthouse"]);
    phoneSync.stop();
    laptopSync.stop();
  });

  it("going offline never blocks play, and catches up later", async () => {
    const cloud = fakeCloud();
    const phone = device();
    const sync = new CloudSync(phone.store, cloud.remote, phone.saves, 0);
    cloud.setOnline(false);
    await sync.start();
    expect(sync.status).toBe("offline");
    phone.store.toggleSaved("ferry", at(1));
    await sync.flush();
    expect(sync.status).toBe("offline");
    expect(phone.store.isSaved("ferry")).toBe(true);
    cloud.setOnline(true);
    await sync.flush();
    expect(sync.status).toBe("synced");
    expect(cloud.state?.saved.ferry).toBe(T(1));
    sync.stop();
  });
});

it("a brand-new profile merges cleanly with an empty account", () => {
  const p = newProfile(at(0));
  expect(mergeProfiles(p, p)).toEqual({ ...p });
});

describe("sign-in error messages", async () => {
  const { friendly } = await import("../packages/player/src/data/account.ts");
  it("only blames the code when verifying a code", () => {
    expect(friendly("verify", "Token has expired or is invalid")).toMatch(/code didn't work/);
    expect(friendly("send", "Invalid API key")).toMatch(/key was rejected: Invalid API key/);
    expect(friendly("send", "Error sending magic link email")).toBe("Couldn't send the code: Error sending magic link email");
    expect(friendly("send", "For security purposes, you can only request this after 52 seconds.")).toMatch(/wait a minute/);
  });
});
