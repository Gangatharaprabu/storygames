import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Catalog, StoryPack, type CatalogEntry } from "@storygames/pack-spec";

/**
 * Scans `packsDir/<folder>/pack.json` and writes `packsDir/catalog.json`: the list of
 * stories the player app shows. Paths in the catalog are relative to `packsDir`.
 */
export function writeCatalog(packsDir: string): Catalog {
  const stories: CatalogEntry[] = [];
  for (const folder of readdirSync(packsDir).sort()) {
    const file = join(packsDir, folder, "pack.json");
    if (!statSync(join(packsDir, folder)).isDirectory() || !existsSync(file)) continue;
    const pack = StoryPack.parse(JSON.parse(readFileSync(file, "utf8")));
    const m = pack.manifest;
    const start = pack.scenes.find((s) => s.id === pack.startScene)!;
    stories.push({
      id: m.id,
      version: m.version,
      title: m.title,
      synopsis: m.synopsis,
      series: m.series,
      tags: m.tags,
      estimatedMinutes: m.estimatedMinutes,
      minEngine: m.minEngine,
      pack: `${folder}/`,
      cover: `${folder}/${m.cover ?? start.background}`,
      cast: pack.cast.map((member) => {
        const c = pack.characters.find((x) => x.id === member.character)!;
        return { id: c.id, name: c.name, role: member.role, portrait: `${folder}/${c.portraits[c.defaultExpression]}` };
      }),
      continuesFrom: [...new Set(Object.values(pack.imports).map((i) => i.from))],
      publishedAt: statSync(file).mtime.toISOString(),
    });
  }
  // Series episodes in order, then standalone stories by title.
  stories.sort((a, b) =>
    (a.series?.title ?? a.title).localeCompare(b.series?.title ?? b.title) || (a.series?.episode ?? 0) - (b.series?.episode ?? 0),
  );
  const catalog = Catalog.parse({ catalogFormat: 1, generatedAt: new Date().toISOString(), stories });
  writeFileSync(join(packsDir, "catalog.json"), JSON.stringify(catalog, null, 2));
  return catalog;
}
