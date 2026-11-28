import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";

import { PrismaService } from "@/database/prisma.service";

import { STORAGE_PROVIDER, type StorageProvider } from "./storage.provider";

/** An upload announced but not confirmed (or a document file never attached) this long ago is abandoned. */
export const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;
const EVERY_MS = 10 * 60 * 1000;
const BATCH = 100;

/**
 * Keeps storage free of objects nothing points to (docs/architecture/backend.md §11). Delete
 * triggers on the file tables queue every removed row's key in `storage_orphans`, whatever
 * removed it (the record, its vehicle, the account). A sweep drops abandoned uploads (which
 * queues them too), then deletes queued objects and their queue rows. No scheduler: it runs at
 * start-up and, at most every ten minutes, after an upload is announced.
 */
@Injectable()
export class StorageSweepService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageSweepService.name);
  private lastRun = 0;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  onApplicationBootstrap() {
    this.soon();
  }

  /** A sweep in the background, unless one ran in the last ten minutes or is running. */
  soon(): void {
    if (this.running || Date.now() - this.lastRun < EVERY_MS) return;
    this.lastRun = Date.now();
    this.running = true;
    this.run()
      .catch((error: unknown) => this.logger.warn({ err: error }, "Storage sweep failed"))
      .finally(() => {
        this.running = false;
      });
  }

  async run(now = new Date()): Promise<{ abandoned: number; deleted: number }> {
    const before = new Date(now.getTime() - ABANDONED_AFTER_MS);
    const old = { createdAt: { lt: before } };
    const removed = await this.prisma.$transaction([
      this.prisma.documentFile.deleteMany({
        where: { ...old, OR: [{ confirmedAt: null }, { documentId: null }] },
      }),
      this.prisma.attachment.deleteMany({ where: { ...old, confirmedAt: null } }),
      this.prisma.tripAttachment.deleteMany({ where: { ...old, confirmedAt: null } }),
    ]);
    const abandoned = removed.reduce((sum, result) => sum + result.count, 0);

    let deleted = 0;
    for (;;) {
      const batch = await this.prisma.storageOrphan.findMany({
        orderBy: { createdAt: "asc" },
        take: BATCH,
      });
      const done: string[] = [];
      for (const { key } of batch) {
        try {
          await this.storage.delete(key);
          done.push(key);
        } catch (error) {
          // Left queued for the next sweep.
          this.logger.warn({ err: error, key }, "Couldn't delete a stored file");
        }
      }
      if (done.length) await this.prisma.storageOrphan.deleteMany({ where: { key: { in: done } } });
      deleted += done.length;
      if (batch.length < BATCH || done.length < batch.length) break;
    }
    return { abandoned, deleted };
  }
}
