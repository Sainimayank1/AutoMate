import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { StorageProvider } from "./storage.provider";

type Grant = { k: string; a: "put" | "get"; e: number; t?: string; m?: number; n?: string };

/** Keys the API makes: users/<uuid>/<uuid>. Anything else is refused (no path tricks). */
const KEY = /^users\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

/**
 * Development and test storage: files on disk under STORAGE_LOCAL_DIR, uploaded and read through
 * the API's /storage/local routes with signed, expiring tokens that stand in for presigned links.
 * Refused in production by env validation (a redeploy would lose the files).
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(
    dir: string,
    private readonly baseUrl: string,
    private readonly secret: string,
  ) {
    this.root = resolve(dir);
  }

  createUploadUrl({
    key,
    contentType,
    maxBytes,
    expiresInSeconds,
  }: Parameters<StorageProvider["createUploadUrl"]>[0]) {
    const token = this.sign({
      k: key,
      a: "put",
      e: this.expiry(expiresInSeconds),
      t: contentType,
      m: maxBytes,
    });
    return Promise.resolve({
      url: `${this.baseUrl}/${token}`,
      headers: { "content-type": contentType },
    });
  }

  createDownloadUrl(key: string, expiresInSeconds: number, fileName: string) {
    return Promise.resolve(
      `${this.baseUrl}/${this.sign({ k: key, a: "get", e: this.expiry(expiresInSeconds), n: fileName })}`,
    );
  }

  async size(key: string) {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async head(key: string, bytes: number) {
    const file = await open(this.path(key), "r");
    try {
      const buffer = new Uint8Array(bytes);
      const { bytesRead } = await file.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  }

  async get(key: string) {
    return new Uint8Array(await readFile(this.path(key)));
  }

  async put(key: string, bytes: Uint8Array) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }

  /** A token's grant if it's genuine, for this action and unexpired; null otherwise. */
  verify(token: string, action: Grant["a"]): Grant | null {
    const [body, mac] = token.split(".");
    if (!body || !mac) return null;
    const expected = this.mac(body);
    if (
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    ) {
      return null;
    }
    const grant = JSON.parse(Buffer.from(body, "base64url").toString()) as Grant;
    return grant.a === action && grant.e > Date.now() && KEY.test(grant.k) ? grant : null;
  }

  /** Writes an upload, stopping (and removing it) past `maxBytes`. False when it was too big. */
  async write(key: string, body: Readable, maxBytes: number): Promise<boolean> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    let received = 0;
    let tooBig = false;
    body.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes && !tooBig) {
        tooBig = true;
        body.destroy();
      }
    });
    try {
      await pipeline(body, createWriteStream(path));
    } catch (error) {
      await rm(path, { force: true });
      if (tooBig) return false;
      throw error;
    }
    return true;
  }

  read(key: string): Readable {
    return createReadStream(this.path(key));
  }

  private path(key: string) {
    if (!KEY.test(key)) throw new Error("Invalid storage key");
    return resolve(this.root, key);
  }

  private expiry(seconds: number) {
    return Date.now() + seconds * 1000;
  }

  private sign(grant: Grant) {
    const body = Buffer.from(JSON.stringify(grant)).toString("base64url");
    return `${body}.${this.mac(body)}`;
  }

  private mac(body: string) {
    return createHmac("sha256", this.secret).update(`storage:${body}`).digest("base64url");
  }
}
