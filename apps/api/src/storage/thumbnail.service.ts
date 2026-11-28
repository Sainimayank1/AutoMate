import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";

import { STORAGE_PROVIDER, type StorageProvider } from "./storage.provider";

/** Longest side of a thumbnail, in pixels (lists show them at up to ~200 px, 2x for sharp screens). */
export const THUMB_PX = 400;
// HEIC is left out: sharp's prebuilt libvips can't decode it.
const THUMBABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Small WebP previews of uploaded photos, stored beside the original under their own key, so
 * lists don't download full-size photos. A preview is a convenience: when it can't be made the
 * file is kept and the original is shown instead.
 */
@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  /** The stored preview's key, or null for PDFs, HEIC and anything that can't be read. */
  async make(userId: string, key: string, contentType: string): Promise<string | null> {
    if (!THUMBABLE.has(contentType)) return null;
    try {
      const thumb = await sharp(await this.storage.get(key), { limitInputPixels: 60_000_000 })
        .rotate()
        .resize(THUMB_PX, THUMB_PX, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
      const thumbKey = `users/${userId}/${randomUUID()}`;
      await this.storage.put(thumbKey, thumb, "image/webp");
      return thumbKey;
    } catch (error) {
      this.logger.warn({ err: error, key }, "Couldn't make a thumbnail");
      return null;
    }
  }
}
