import { randomUUID } from "node:crypto";

import {
  addDays,
  createDocumentSchema,
  type CreateDocumentValues,
  type CreateUploadValues,
  type DocumentFile,
  type DocumentListQuery,
  DocumentState,
  type DocumentSummary,
  type DocumentSummaryQuery,
  EXPIRING_DAYS,
  type FileLink,
  istToday,
  MAX_DOCUMENT_FILE_BYTES,
  pageMeta,
  type UpdateDocumentValues,
  type UploadSlot,
  type VehicleDocument,
} from "@automate/shared";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ZodValidationException } from "nestjs-zod";

import { pageArgs, Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import type { Prisma } from "@/generated/prisma/client";
import { VehiclesService } from "@/modules/vehicles/vehicles.service";
import { SIGNATURE_BYTES, sniffType } from "@/storage/file-signature";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";
import { StorageSweepService } from "@/storage/storage-sweep.service";

import { stateWindow } from "./document-state";
import {
  DOCUMENT_WITH,
  type DocumentRow,
  toDbDate,
  toDocument,
  toDocumentFile,
  toDocumentInput,
} from "./documents.mapper";

type Db = Prisma.TransactionClient | PrismaService;
const NOT_FOUND = "Document not found";
const UPLOAD_SECONDS = 10 * 60;
const LINK_SECONDS = 5 * 60;
const fieldError = (field: string, message: string) => ({ message, details: [{ field, message }] });

/**
 * Documents & reminders (M6, docs/architecture/documents.md). Files go straight to private
 * storage through short-lived links: an upload is announced, PUT by the browser, then confirmed
 * (it exists, its size and real type match) before it can be attached. The state (valid, expiring,
 * expired) is worked out from the expiry date on every read.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly sweep: StorageSweepService,
  ) {}

  async list(userId: string, query: DocumentListQuery): Promise<Paginated<VehicleDocument>> {
    if (query.vehicleId) await this.vehicles.findOwned(userId, query.vehicleId);
    const today = istToday(new Date());
    const where = this.where(userId, query, today);
    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: DOCUMENT_WITH,
        // Expired and soonest to expire first; papers without an expiry last.
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { name: "asc" }, { id: "asc" }],
        ...pageArgs(query),
      }),
      this.prisma.document.count({ where }),
    ]);
    return new Paginated(
      rows.map((row) => toDocument(row, today)),
      pageMeta(query, total),
    );
  }

  async summary(userId: string, { vehicleId }: DocumentSummaryQuery): Promise<DocumentSummary> {
    if (vehicleId) await this.vehicles.findOwned(userId, vehicleId);
    const today = istToday(new Date());
    const base = { userId, ...(vehicleId ? { vehicleId } : {}) };
    const count = (state: DocumentState) =>
      this.prisma.document.count({ where: this.where(userId, { vehicleId, state }, today) });
    const [total, valid, expiring, expired, noExpiry, vehicles] = await Promise.all([
      this.prisma.document.count({ where: base }),
      count(DocumentState.VALID),
      count(DocumentState.EXPIRING),
      count(DocumentState.EXPIRED),
      count(DocumentState.NO_EXPIRY),
      this.prisma.document.findMany({
        where: { ...base, vehicleId: vehicleId ?? { not: null } },
        distinct: ["vehicleId"],
        select: { vehicleId: true },
      }),
    ]);
    return { total, valid, expiring, expired, noExpiry, vehicles: vehicles.length };
  }

  /**
   * Documents expired or expiring within `horizonDays` (soonest first), for the dashboard and
   * Notifications. Every user document when `vehicleId` is left out.
   */
  async expiring(
    userId: string,
    { vehicleId, horizonDays = EXPIRING_DAYS }: { vehicleId?: string; horizonDays?: number },
  ): Promise<VehicleDocument[]> {
    const today = istToday(new Date());
    const rows = await this.prisma.document.findMany({
      where: {
        userId,
        ...(vehicleId ? { vehicleId } : {}),
        expiryDate: { lte: toDbDate(addDays(today, horizonDays)) },
      },
      include: DOCUMENT_WITH,
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => toDocument(row, today));
  }

  /**
   * Documents a reminder could be due for (Notifications): expiring within the longest reminder
   * lead (365 days) or already expired, or with a remind-on date that has come.
   */
  async toRemind(userId: string): Promise<VehicleDocument[]> {
    const today = istToday(new Date());
    const rows = await this.prisma.document.findMany({
      where: {
        userId,
        OR: [
          { expiryDate: { lte: toDbDate(addDays(today, 365)) } },
          { remindOn: { lte: toDbDate(today) } },
        ],
      },
      include: DOCUMENT_WITH,
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    });
    return rows.map((row) => toDocument(row, today));
  }

  /** Every document of one vehicle, soonest to expire first (the dashboard needs a handful). */
  async forVehicle(userId: string, vehicleId: string): Promise<VehicleDocument[]> {
    const today = istToday(new Date());
    const rows = await this.prisma.document.findMany({
      where: { userId, vehicleId },
      include: DOCUMENT_WITH,
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    });
    return rows.map((row) => toDocument(row, today));
  }

  /** The vehicle's newest documents, for the dashboard's activity feed. */
  async recent(userId: string, vehicleId: string, take: number) {
    const where = { userId, vehicleId };
    const today = istToday(new Date());
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: DOCUMENT_WITH,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
      }),
      this.prisma.document.count({ where }),
    ]);
    return { recent: rows.map((row) => toDocument(row, today)), count };
  }

  async get(userId: string, id: string): Promise<VehicleDocument> {
    return toDocument(await this.owned(userId, id), istToday(new Date()));
  }

  async create(userId: string, values: CreateDocumentValues): Promise<VehicleDocument> {
    const id = await this.prisma.$transaction(async (tx) => {
      if (values.vehicleId) await this.vehicles.findOwned(userId, values.vehicleId);
      const created = await tx.document.create({ data: { userId, ...this.data(values) } });
      await this.attach(tx, userId, created.id, values.fileIds);
      return created.id;
    });
    this.logger.log(`Document ${id} created`);
    return this.get(userId, id);
  }

  /** Merged onto the stored document and checked whole; `fileIds` replaces the attached files. */
  async update(userId: string, id: string, input: UpdateDocumentValues): Promise<VehicleDocument> {
    const removed = await this.prisma.$transaction(async (tx) => {
      const current = await this.owned(userId, id, tx);
      const parsed = createDocumentSchema.safeParse({
        ...toDocumentInput(current),
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      });
      if (!parsed.success) throw new ZodValidationException(parsed.error);
      if (parsed.data.vehicleId && parsed.data.vehicleId !== current.vehicleId) {
        await this.vehicles.findOwned(userId, parsed.data.vehicleId);
      }
      await tx.document.update({ where: { id }, data: this.data(parsed.data) });
      const gone = current.files.filter((file) => !parsed.data.fileIds.includes(file.id));
      if (gone.length)
        await tx.documentFile.deleteMany({ where: { id: { in: gone.map((f) => f.id) } } });
      await this.attach(tx, userId, id, parsed.data.fileIds);
      return gone;
    });
    await this.forget(removed.map((file) => file.key));
    this.logger.log(`Document ${id} updated`);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.owned(userId, id);
    await this.prisma.$transaction([
      this.prisma.documentFile.deleteMany({ where: { documentId: id } }),
      this.prisma.document.delete({ where: { id } }),
    ]);
    await this.forget(current.files.map((file) => file.key));
    this.logger.log(`Document ${id} deleted`);
  }

  /** An upload slot: the browser PUTs the file straight to storage, then confirms it. */
  async createUpload(userId: string, values: CreateUploadValues): Promise<UploadSlot> {
    const key = `users/${userId}/${randomUUID()}`;
    const file = await this.prisma.documentFile.create({
      data: {
        userId,
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
    // Uploads never confirmed (or never attached) are swept after a day.
    this.sweep.soon();
    return {
      fileId: file.id,
      url,
      headers,
      expiresAt: new Date(Date.now() + UPLOAD_SECONDS * 1000).toISOString(),
    };
  }

  /** It arrived, its size is what was announced, and its first bytes say it's that type. */
  async confirmUpload(userId: string, fileId: string): Promise<DocumentFile> {
    const file = await this.prisma.documentFile.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new NotFoundException("Upload not found");
    if (file.confirmedAt) return toDocumentFile(file);
    const size = await this.storage.size(file.key);
    if (size === null) {
      throw new BadRequestException(fieldError("file", "The file didn't arrive. Upload it again."));
    }
    const type = size > 0 ? sniffType(await this.storage.head(file.key, SIGNATURE_BYTES)) : null;
    if (size !== file.size || size > MAX_DOCUMENT_FILE_BYTES || type !== file.contentType) {
      await this.prisma.documentFile.delete({ where: { id: file.id } });
      await this.forget([file.key]);
      throw new BadRequestException(
        fieldError(
          "file",
          type !== file.contentType
            ? "That file isn't the PDF or photo it says it is."
            : "The file changed while uploading. Upload it again.",
        ),
      );
    }
    const confirmed = await this.prisma.documentFile.update({
      where: { id: file.id },
      data: { confirmedAt: new Date() },
    });
    return toDocumentFile(confirmed);
  }

  /** A link to one of a document's files, valid for a few minutes. */
  async fileLink(userId: string, documentId: string, fileId: string): Promise<FileLink> {
    const file = await this.prisma.documentFile.findFirst({
      where: { id: fileId, userId, documentId, confirmedAt: { not: null } },
    });
    if (!file) throw new NotFoundException("File not found");
    return {
      url: await this.storage.createDownloadUrl(file.key, LINK_SECONDS, file.fileName),
      expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString(),
    };
  }

  private where(
    userId: string,
    query: Partial<Pick<DocumentListQuery, "vehicleId" | "type" | "state" | "search">>,
    today: string,
  ): Prisma.DocumentWhereInput {
    const window = query.state ? stateWindow(query.state, today) : undefined;
    const search = query.search?.trim();
    return {
      userId,
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.state
        ? {
            expiryDate: window
              ? Object.fromEntries(
                  Object.entries(window as Record<string, string>).map(([op, date]) => [
                    op,
                    toDbDate(date),
                  ]),
                )
              : null,
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { number: { contains: search, mode: "insensitive" } },
              { issuer: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private data(values: CreateDocumentValues) {
    return {
      vehicleId: values.vehicleId ?? null,
      type: values.type,
      name: values.name,
      number: values.number ?? null,
      issuer: values.issuer ?? null,
      issueDate: values.issueDate ? toDbDate(values.issueDate) : null,
      expiryDate: values.expiryDate ? toDbDate(values.expiryDate) : null,
      notes: values.notes ?? null,
      reminderDays: [...new Set(values.reminderDays)].sort((a, b) => b - a),
      remindOn: values.remindOn ? toDbDate(values.remindOn) : null,
    };
  }

  /** Confirmed uploads of the user's, not on another document, onto this one. */
  private async attach(
    tx: Prisma.TransactionClient,
    userId: string,
    documentId: string,
    fileIds: string[],
  ) {
    if (!fileIds.length) return;
    const { count } = await tx.documentFile.updateMany({
      where: {
        id: { in: fileIds },
        userId,
        confirmedAt: { not: null },
        OR: [{ documentId: null }, { documentId }],
      },
      data: { documentId },
    });
    if (count !== new Set(fileIds).size) {
      throw new BadRequestException(fieldError("fileIds", "A file isn't ready. Upload it again."));
    }
  }

  private async owned(userId: string, id: string, db: Db = this.prisma): Promise<DocumentRow> {
    const row = await db.document.findFirst({ where: { id, userId }, include: DOCUMENT_WITH });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  /** Removes objects after their rows are gone; a failure is logged, never undoes the delete. */
  private async forget(keys: string[]) {
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.logger.warn(`Couldn't delete stored file ${key}: ${String(error)}`);
      }
    }
  }
}
