import { AwsClient } from "aws4fetch";

import type { StorageProvider } from "./storage.provider";

/**
 * Cloudflare R2 (or any S3 bucket) through presigned requests: the browser PUTs and GETs the
 * object directly, so file bytes never pass through the API. A presigned PUT can't cap the size,
 * so the API checks it on confirm and deletes an oversized object. The bucket must allow the web
 * origin to PUT and GET (its CORS rules).
 */
export class BucketStorageProvider implements StorageProvider {
  private readonly client: AwsClient;

  constructor(
    private readonly endpoint: string,
    private readonly bucket: string,
    credentials: { accessKeyId: string; secretAccessKey: string; region: string },
  ) {
    this.client = new AwsClient({ ...credentials, service: "s3" });
  }

  async createUploadUrl({
    key,
    contentType,
    expiresInSeconds,
  }: Parameters<StorageProvider["createUploadUrl"]>[0]) {
    const url = this.url(key);
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await this.client.sign(
      new Request(url, { method: "PUT", headers: { "content-type": contentType } }),
      { aws: { signQuery: true, allHeaders: true } },
    );
    return { url: signed.url, headers: { "content-type": contentType } };
  }

  async createDownloadUrl(key: string, expiresInSeconds: number, fileName: string) {
    const url = this.url(key);
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    url.searchParams.set(
      "response-content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    const signed = await this.client.sign(new Request(url, { method: "GET" }), {
      aws: { signQuery: true },
    });
    return signed.url;
  }

  async size(key: string) {
    const response = await this.client.fetch(this.url(key), { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Storage HEAD failed: ${response.status}`);
    return Number(response.headers.get("content-length") ?? 0);
  }

  async head(key: string, bytes: number) {
    const response = await this.client.fetch(this.url(key), {
      headers: { range: `bytes=0-${bytes - 1}` },
    });
    if (!response.ok) throw new Error(`Storage GET failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async get(key: string) {
    const response = await this.client.fetch(this.url(key));
    if (!response.ok) throw new Error(`Storage GET failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async put(key: string, bytes: Uint8Array, contentType: string) {
    const response = await this.client.fetch(this.url(key), {
      method: "PUT",
      headers: { "content-type": contentType },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Storage PUT failed: ${response.status}`);
  }

  async delete(key: string) {
    const response = await this.client.fetch(this.url(key), { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Storage DELETE failed: ${response.status}`);
    }
  }

  /** Path-style: <endpoint>/<bucket>/<key> (R2 and most S3-compatible stores accept it). */
  private url(key: string) {
    return new URL(`${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`);
  }
}
