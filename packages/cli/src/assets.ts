import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import sharp from "sharp";
import { CANVAS, type Problem } from "@storygames/pack-spec";

/** Raster images are converted to WebP and scaled down to fit the portrait canvas. */
const RASTER = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const WEBP_QUALITY = 82;
const CACHE_DIR = resolve("node_modules/.cache/storygames-images");

export interface AssetJob {
  /** Absolute source file. */
  from: string;
  /** Path inside the pack, as referenced by the story (e.g. `art/harbour.png`). */
  path: string;
  /** Backgrounds get extra checks (aspect ratio, resolution). */
  kind: "background" | "image" | "other";
}

/**
 * Writes every asset into `outDir`. Returns a map of renamed paths
 * (`art/harbour.png` → `art/harbour.webp`) for rewriting the pack.
 * Converted images are cached by content, so rebuilds in watch mode are fast.
 */
export async function writeAssets(jobs: AssetJob[], outDir: string, warnings: Problem[]): Promise<Map<string, string>> {
  const renamed = new Map<string, string>();
  const done = new Set<string>();
  for (const job of jobs) {
    if (done.has(job.path)) continue;
    done.add(job.path);
    const ext = extname(job.from).toLowerCase();

    if (!RASTER.has(ext)) {
      const to = join(outDir, job.path);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(job.from, to);
      continue;
    }

    const newPath = job.path.slice(0, job.path.length - extname(job.path).length) + ".webp";
    renamed.set(job.path, newPath);
    const source = readFileSync(job.from);

    if (job.kind === "background") {
      const { width = 0, height = 0 } = await sharp(source).metadata();
      const ratio = width / height;
      if (Math.abs(ratio - 9 / 16) > 0.02) {
        warnings.push({ path: job.path, message: `background is ${width}×${height}; portrait 9:16 (e.g. 1080×1920) fits best` });
      }
      if (width < CANVAS.width * 0.75) {
        warnings.push({ path: job.path, message: `background is only ${width}px wide and may look blurry on phones (aim for ${CANVAS.width})` });
      }
    }

    const key = createHash("sha1").update(source).update(`${CANVAS.width}x${CANVAS.height}q${WEBP_QUALITY}`).digest("hex");
    const cached = join(CACHE_DIR, `${key}.webp`);
    if (!existsSync(cached)) {
      mkdirSync(CACHE_DIR, { recursive: true });
      await sharp(source)
        .resize({ width: CANVAS.width, height: CANVAS.height, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, alphaQuality: 90 })
        .toFile(cached);
    }
    const to = join(outDir, newPath);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(cached, to);
  }
  return renamed;
}
