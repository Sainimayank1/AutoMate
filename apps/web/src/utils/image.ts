/** Photos larger than this on their long side are scaled down before upload. */
export const MAX_IMAGE_SIDE = 2048;
/** Smaller files go as they are. */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const RESIZABLE = ["image/jpeg", "image/png", "image/webp"];

/**
 * A big photo (a phone's 12 MP receipt shot) scaled to fit MAX_IMAGE_SIDE and re-encoded before
 * it's uploaded: smaller storage, quicker thumbnails, same flow and checks after. PNGs become
 * WebP (keeping transparency), JPEGs stay JPEG. PDFs, HEIC (browsers can't draw it), small files
 * and anything that wouldn't get smaller go unchanged, as does everything where the browser has
 * no canvas support.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (
    !RESIZABLE.includes(file.type) ||
    file.size <= SHRINK_ABOVE_BYTES ||
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  ) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = type === file.type ? file.name : file.name.replace(/\.\w+$/, "") + ".webp";
    return new File([blob], name, { type });
  } catch {
    return file; // an image the browser can't decode goes as it is; the API still checks it
  }
}
