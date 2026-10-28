import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildCatalog, SeriesSource, type CatalogInput } from "@storygames/builder";
import { StoryPack, type Catalog } from "@storygames/pack-spec";

/** Folder inside the packs dir where build-all puts series descriptions. */
export const SERIES_DIR = "_series";


/**
 * Scans `packsDir/<folder>/pack.json` (and `packsDir/_series/*.json`) and writes
 * `packsDir/catalog.json`. Used for local builds; publishing uses buildCatalog directly.
 */
export function writeCatalog(packsDir: string): Catalog {
  const inputs: CatalogInput[] = [];
  for (const folder of readdirSync(packsDir).sort()) {
    const file = join(packsDir, folder, "pack.json");
    if (!statSync(join(packsDir, folder)).isDirectory() || !existsSync(file)) continue;
    inputs.push({
      folder: `${folder}/`,
      pack: StoryPack.parse(JSON.parse(readFileSync(file, "utf8"))),
      publishedAt: statSync(file).mtime.toISOString(),
    });
  }
  const series: Array<{ id: string; title: string; synopsis: string }> = [];
  const seriesDir = join(packsDir, SERIES_DIR);
  if (existsSync(seriesDir)) {
    for (const f of readdirSync(seriesDir).filter((n) => n.endsWith(".json"))) {
      series.push(SeriesSource.parse(JSON.parse(readFileSync(join(seriesDir, f), "utf8"))));
    }
  }
  const catalog = buildCatalog(inputs, series);
  writeFileSync(join(packsDir, "catalog.json"), JSON.stringify(catalog, null, 2));
  return catalog;
}
