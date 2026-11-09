import path from "path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
export const MAX_UPLOAD_BYTES = 150 * 1024 * 1024;

export type AssetKind = "image" | "audio" | "video";

// SVG is deliberately excluded: served from our own origin it could run script.
export const ALLOWED_TYPES: Record<string, { ext: string; kind: AssetKind }> = {
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/x-wav": { ext: "wav", kind: "audio" },
  "audio/wave": { ext: "wav", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/x-m4a": { ext: "m4a", kind: "audio" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};

const MIME_BY_EXT: Record<string, string> = {};
for (const [mime, { ext }] of Object.entries(ALLOWED_TYPES)) MIME_BY_EXT[ext] ??= mime;

export function mimeForFileName(fileName: string): string | null {
  return MIME_BY_EXT[path.extname(fileName).slice(1).toLowerCase()] ?? null;
}

export function mediaUrl(fileName: string): string {
  return `/media/${fileName}`;
}

export function isSafeFileName(fileName: string): boolean {
  return /^[a-z0-9]{16,40}\.[a-z0-9]{2,4}$/.test(fileName);
}
