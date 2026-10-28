import { buildPack, type PackBuild } from "@storygames/builder";
import { draftFolder, type StudioApi } from "./api.ts";
import { LIBRARY, storyRoot } from "./drafts.ts";
import { mime } from "./state.tsx";

export interface DraftBuild {
  build: PackBuild;
  /** The bytes of every file the pack needs (path inside the pack → contents). */
  files: () => Promise<Array<{ path: string; body: Uint8Array }>>;
}

/** Builds a story from its drafts, the same way the CLI builds from the repo. */
export async function buildDraft(api: StudioApi, storyId: string, opts: { draft?: boolean } = {}): Promise<DraftBuild> {
  const folders = { story: draftFolder(api, storyRoot(storyId)), library: draftFolder(api, LIBRARY) };
  const build = await buildPack(folders, opts);
  return {
    build,
    files: async () =>
      Promise.all(
        build.assets.map(async (a) => {
          const body = await folders[a.from.folder].bytes(a.from.path);
          if (!body) throw new Error(`${a.from.path} is missing`);
          return { path: a.path, body };
        }),
      ),
  };
}

/** Blob URLs for every file of a built pack, for playing it in the Studio. */
export async function previewUrls(d: DraftBuild): Promise<Map<string, string>> {
  const files = await d.files();
  return new Map(files.map((f) => [f.path, URL.createObjectURL(new Blob([f.body as BlobPart], { type: mime(f.path) }))]));
}
