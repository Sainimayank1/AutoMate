/**
 * Contract for private object storage (Cloudflare R2 / S3). No implementation is registered yet;
 * the Documents module (M6) adds an R2 implementation bound to STORAGE_PROVIDER.
 * Design notes: docs/architecture/backend.md#file-storage
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
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;

  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
