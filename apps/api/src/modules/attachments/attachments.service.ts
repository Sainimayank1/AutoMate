import { randomUUID } from "node:crypto";

import {
  type Attachment,
  type AttachmentListQuery,
  type AttachmentOwner,
  type CreateAttachmentUploadValues,
  type DocumentFileType,
  type FileLink,
  MAX_ATTACHMENTS,
  MAX_DOCUMENT_FILE_BYTES,
  pageMeta,
  type UploadSlot,
} from "@automate/shared";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Attachment as AttachmentRow, Prisma } from "@/generated/prisma/client";
import { SIGNATURE_BYTES, sniffType } from "@/storage/file-signature";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";
import { StorageSweepService } from "@/storage/storage-sweep.service";

const UPLOAD_SECONDS = 10 * 60;
const LINK_SECONDS = 5 * 60;
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

/** The column that names each kind of owner. */
const OWNER_COLUMN = {
  expense: "expenseId",
  "service-record": "serviceRecordId",
  component: "componentId",
  inspection: "inspectionId",
} as const satisfies Record<AttachmentOwner, keyof AttachmentRow>;

const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  fileName: row.fileName,
  contentType: row.contentType as DocumentFileType,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Receipts and other files on an expense, a service record, a tracked part or an inspection: the
 * same private-storage flow as documents (announce, PUT straight to storage, confirm by size and
 * magic bytes, short-lived links). A file goes with its record: the delete trigger queues its
 * object for the storage sweep.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly sweep: StorageSweepService,
  ) {}

  /** A record's confirmed files, oldest first. */
  async list(userId: string, { owner, ownerId, ...page }: AttachmentListQuery) {
    await this.assertOwner(userId, owner, ownerId);
    const where = { userId, [OWNER_COLUMN[owner]]: ownerId, confirmedAt: { not: null } };
    const [rows, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        ...pageArgs(page),
      }),
      this.prisma.attachment.count({ where }),
    ]);
    return new Paginated(rows.map(toAttachment), pageMeta(page, total));
  }

  async createUpload(userId: string, values: CreateAttachmentUploadValues): Promise<UploadSlot> {
    const { owner, ownerId } = values;
    await this.assertOwner(userId, owner, ownerId);
    const count = await this.prisma.attachment.count({
      where: { userId, [OWNER_COLUMN[owner]]: ownerId, confirmedAt: { not: null } },
    });
    if (count >= MAX_ATTACHMENTS) {
      throw new BadRequestException(
        fieldError("file", `Up to ${MAX_ATTACHMENTS} files each: remove one first.`),
      );
    }
    const key = `users/${userId}/${randomUUID()}`;
    const row = await this.prisma.attachment.create({
      data: {
        userId,
        [OWNER_COLUMN[owner]]: ownerId,
        key,
        fileName: values.fileName,
        contentType: values.contentType,
        size: values.size,
      },
    });
    const { url, headers } = await this.storage.createUploadUrl({
      key,
      contentType: values.contentType,
      maxBytes: values.size,
      expiresInSeconds: UPLOAD_SECONDS,
    });
    // Uploads never confirmed are swept after a day.
    this.sweep.soon();
    return {
      fileId: row.id,
      url,
      headers,
      expiresAt: new Date(Date.now() + UPLOAD_SECONDS * 1000).toISOString(),
    };
  }

  /** It arrived, its size is what was announced, and its first bytes say it's that type. */
  async confirm(userId: string, fileId: string): Promise<Attachment> {
    const row = await this.prisma.attachment.findFirst({ where: { id: fileId, userId } });
    if (!row) throw new NotFoundException("Upload not found");
    if (row.confirmedAt) return toAttachment(row);
    const size = await this.storage.size(row.key);
    if (size === null) {
      throw new BadRequestException(fieldError("file", "The file didn't arrive. Upload it again."));
    }
    const type = size > 0 ? sniffType(await this.storage.head(row.key, SIGNATURE_BYTES)) : null;
    if (size !== row.size || size > MAX_DOCUMENT_FILE_BYTES || type !== row.contentType) {
      await this.remove(userId, row.id);
      throw new BadRequestException(
        fieldError(
          "file",
          type !== row.contentType
            ? "That file isn't the PDF or photo it says it is."
            : "The file changed while uploading. Upload it again.",
        ),
      );
    }
    return toAttachment(
      await this.prisma.attachment.update({
        where: { id: row.id },
        data: { confirmedAt: new Date() },
      }),
    );
  }

  /** A link to the file, valid for a few minutes. */
  async link(userId: string, id: string): Promise<FileLink> {
    const row = await this.prisma.attachment.findFirst({
      where: { id, userId, confirmedAt: { not: null } },
    });
    if (!row) throw new NotFoundException("File not found");
    return {
      url: await this.storage.createDownloadUrl(row.key, LINK_SECONDS, row.fileName),
      expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString(),
    };
  }

  /** The row goes now; the object right away too, or with the next sweep if storage is slow. */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.attachment.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException("File not found");
    await this.prisma.attachment.delete({ where: { id } });
    try {
      await this.storage.delete(row.key);
    } catch (error) {
      this.logger.warn({ err: error }, "Couldn't delete a stored file; the sweep will");
    }
  }

  /** The record must be the user's own (404 otherwise, as for any record). */
  private async assertOwner(userId: string, owner: AttachmentOwner, id: string) {
    const where = { id, userId };
    const found: Prisma.PrismaPromise<{ id: string } | null> =
      owner === "expense"
        ? this.prisma.expense.findFirst({ where, select: { id: true } })
        : owner === "service-record"
          ? this.prisma.serviceRecord.findFirst({ where, select: { id: true } })
          : owner === "component"
            ? this.prisma.vehicleComponent.findFirst({ where, select: { id: true } })
            : this.prisma.inspection.findFirst({ where, select: { id: true } });
    if (!(await found)) throw new NotFoundException("Record not found");
  }
}
