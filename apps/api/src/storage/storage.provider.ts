/**
 * Contract for private object storage. `LocalStorageProvider` keeps files on disk for development
 * and tests; `BucketStorageProvider` presigns requests to Cloudflare R2 (or any S3 bucket).
 * Design notes: docs/architecture/backend.md#11-file-storage-strategy, documents.md.
 */
export interface StorageProvider {
  /** Short-lived URL the client PUTs the file to directly; the API never proxies file bytes. */
  createUploadUrl(input: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds: number;
  }): Promise<{ url: string; headers: Record<string, string> }>;

  /** Short-lived URL to read a private object, issued only after an ownership check. */
  createDownloadUrl(key: string, expiresInSeconds: number, fileName: string): Promise<string>;

  /** The object's size, or null when nothing was uploaded under the key. */
  size(key: string): Promise<number | null>;

  /** The object's first bytes, to check its real type. */
  head(key: string, bytes: number): Promise<Uint8Array>;

  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
