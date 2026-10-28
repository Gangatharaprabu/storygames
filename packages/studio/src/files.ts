/** Uploads: art becomes WebP scaled to fit the portrait canvas; SVG and audio go up as they are. */

export interface PreparedFile {
  body: Blob;
  ext: string;
  /** Pixel size, for images. */
  width?: number;
  height?: number;
}

const MAX = { w: 1080, h: 1920 };
const RASTER = /\.(png|jpe?g|webp|gif|avif)$/i;
const AUDIO = /\.(mp3|m4a|ogg|wav)$/i;

export const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp,image/svg+xml";
export const ACCEPT_AUDIO = "audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav";

export async function prepareUpload(file: File): Promise<PreparedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".svg")) return { body: file, ext: ".svg" };
  if (AUDIO.test(name)) return { body: file, ext: name.slice(name.lastIndexOf(".")) };
  if (!RASTER.test(name) && !file.type.startsWith("image/")) throw new Error("Use PNG, JPG, WebP or SVG for art, and MP3, M4A, OGG or WAV for sound.");

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX.w / bitmap.width, MAX.h / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  // Browsers without WebP encoding (old Safari) hand back PNG instead.
  if (!blob) throw new Error("Couldn't convert that image.");
  return { body: blob, ext: blob.type === "image/webp" ? ".webp" : ".png", width: bitmap.width, height: bitmap.height };
}

/** A note about a background that won't fill a portrait phone screen well. */
export function backgroundAdvice(p: PreparedFile): string | undefined {
  if (!p.width || !p.height) return undefined;
  if (Math.abs(p.width / p.height - 9 / 16) > 0.03) return `This picture is ${p.width}×${p.height}. Backgrounds look best in portrait 9:16 (e.g. 1080×1920); the edges will be cropped.`;
  if (p.width < 800) return `This picture is only ${p.width} pixels wide and may look blurry on phones (aim for 1080).`;
  return undefined;
}
