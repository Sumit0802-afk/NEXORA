/** Checks for a reference photo chosen by the user. Everything runs in the browser; the file is never uploaded. */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MIN_PHOTO_SIDE = 300;
export const MAX_PHOTO_SIDE = 12000;

export type PhotoKind = "jpeg" | "png" | "webp";

/** The real format from the file's first bytes, not from its name or the type the browser reports. */
export function sniffImage(head: Uint8Array): PhotoKind | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b)) return "png";
  if (
    head.length >= 12 &&
    String.fromCharCode(...head.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...head.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export type PhotoCheck = { ok: true; kind: PhotoKind } | { ok: false; reason: string };

export function checkPhotoFile(file: { size: number }, head: Uint8Array): PhotoCheck {
  if (file.size === 0) return { ok: false, reason: "That file is empty." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, reason: "That photo is larger than 8 MB. Choose a smaller one." };
  const kind = sniffImage(head);
  if (!kind) return { ok: false, reason: "Choose a JPEG, PNG or WebP photo." };
  return { ok: true, kind };
}

export function checkPhotoSize(width: number, height: number): PhotoCheck | { ok: true; kind?: undefined } {
  if (Math.min(width, height) < MIN_PHOTO_SIDE) {
    return { ok: false, reason: `The photo is too small (${width}×${height}). Use one at least ${MIN_PHOTO_SIDE} pixels on its shorter side.` };
  }
  if (Math.max(width, height) > MAX_PHOTO_SIDE) return { ok: false, reason: "The photo has unusually large dimensions. Choose a smaller version." };
  return { ok: true };
}

/** Reads and validates a chosen file; returns a temporary object URL for showing it on screen. */
export async function loadPhoto(file: File): Promise<{ ok: true; url: string; width: number; height: number; kind: PhotoKind } | { ok: false; reason: string }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const basic = checkPhotoFile(file, head);
  if (!basic.ok) return basic;
  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("decode"));
      img.src = url;
    });
    const size = checkPhotoSize(dims.width, dims.height);
    if (!size.ok) {
      URL.revokeObjectURL(url);
      return size;
    }
    return { ok: true, url, ...dims, kind: basic.kind };
  } catch {
    URL.revokeObjectURL(url);
    return { ok: false, reason: "That file could not be read as an image. It may be damaged." };
  }
}
