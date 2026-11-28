import { randomUUID } from "node:crypto";

import {
  type CreateTripUploadValues,
  type DocumentFileType,
  type FileLink,
  MAX_DOCUMENT_FILE_BYTES,
  type PaginationQuery,
  TRIP_ATTACHMENTS_MAX,
  type TripAttachment,
  type UploadSlot,
} from "@automate/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { Paginated } from "@/common/pagination/paginated";
import { PrismaService } from "@/database/prisma.service";
import { SIGNATURE_BYTES, sniffType } from "@/storage/file-signature";
import { STORAGE_PROVIDER, type StorageProvider } from "@/storage/storage.provider";
import { StorageSweepService } from "@/storage/storage-sweep.service";

import { assertActive } from "./trips.service";

const UPLOAD_SECONDS = 10 * 60;
const LINK_SECONDS = 5 * 60;
const fileError = (message: string) => ({ message, details: [{ field: "file", message }] });

type AttachmentRow = {
  id: string;
  tripId: string;
  costId: string | null;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: Date;
};
const toAttachment = (row: AttachmentRow): TripAttachment => ({
  id: row.id,
  tripId: row.tripId,
  costId: row.costId,
  fileName: row.fileName,
  contentType: row.contentType as DocumentFileType,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
});

/**
 * A trip's photos and receipts (trips.md §1 "Attachments"), through the one storage provider as
 * Documents uses it: the upload is announced, PUT by the browser straight to storage, then
 * confirmed (it arrived, its size matches and its first bytes say it's that type). Links last a
 * few minutes and are issued only after an ownership check. Deleted rows' objects are removed by
 * the storage cleanup queue (database triggers), whichever way they're deleted.
 */
@Injectable()
export class TripAttachmentsService {
  private readonly logger = new Logger(TripAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly sweep: StorageSweepService,
  ) {}

  /** A trip's confirmed files, oldest first (at most `TRIP_ATTACHMENTS_MAX`). */
  async list(userId: string, tripId: string, query: PaginationQuery) {
    await this.trip(userId, tripId);
    const rows = await this.prisma.tripAttachment.findMany({
      where: { tripId, userId, confirmedAt: { not: null } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return Paginated.of(rows.map(toAttachment), query);
  }

  async createUpload(
    userId: string,
    tripId: string,
    values: CreateTripUploadValues,
  ): Promise<UploadSlot> {
    await this.trip(userId, tripId, true);
    if (values.costId) {
      const cost = await this.prisma.tripCost.findFirst({
        where: { id: values.costId, tripId, userId },
        select: { id: true },
      });
      if (!cost) throw new NotFoundException("Trip cost not found");
    }
    const count = await this.prisma.tripAttachment.count({ where: { tripId, userId } });
    if (count >= TRIP_ATTACHMENTS_MAX) {
      throw new ConflictException(
        fileError(`A trip holds up to ${TRIP_ATTACHMENTS_MAX} photos and receipts.`),
      );
    }
    const key = `users/${userId}/${randomUUID()}`;
    const row = await this.prisma.tripAttachment.create({
      data: {
        userId,
        tripId,
        costId: values.costId ?? null,
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
    // Abandoned uploads (never confirmed) are cleared by the sweep, throttled.
    this.sweep.soon();
    return {
      fileId: row.id,
      url,
      headers,
      expiresAt: new Date(Date.now() + UPLOAD_SECONDS * 1000).toISOString(),
    };
  }

  async confirm(userId: string, tripId: string, id: string): Promise<TripAttachment> {
    const row = await this.prisma.tripAttachment.findFirst({ where: { id, tripId, userId } });
    if (!row) throw new NotFoundException("Upload not found");
    if (row.confirmedAt) return toAttachment(row);
    const size = await this.storage.size(row.key);
    if (size === null) {
      throw new BadRequestException(fileError("The file didn't arrive. Upload it again."));
    }
    const type = size > 0 ? sniffType(await this.storage.head(row.key, SIGNATURE_BYTES)) : null;
    if (size !== row.size || size > MAX_DOCUMENT_FILE_BYTES || type !== row.contentType) {
      // The cleanup queue removes the stored object once the row is gone.
      await this.prisma.tripAttachment.delete({ where: { id } });
      throw new BadRequestException(
        fileError(
          type !== row.contentType
            ? "That file isn't the PDF or photo it says it is."
            : "The file changed while uploading. Upload it again.",
        ),
      );
    }
    const confirmed = await this.prisma.tripAttachment.update({
      where: { id },
      data: { confirmedAt: new Date() },
    });
    this.logger.log(`Trip attachment ${id} added to trip ${tripId}`);
    return toAttachment(confirmed);
  }

  /** A link to the file, valid for a few minutes. */
  async link(userId: string, tripId: string, id: string): Promise<FileLink> {
    const row = await this.prisma.tripAttachment.findFirst({
      where: { id, tripId, userId, confirmedAt: { not: null } },
    });
    if (!row) throw new NotFoundException("File not found");
    return {
      url: await this.storage.createDownloadUrl(row.key, LINK_SECONDS, row.fileName),
      expiresAt: new Date(Date.now() + LINK_SECONDS * 1000).toISOString(),
    };
  }

  async remove(userId: string, tripId: string, id: string): Promise<void> {
    await this.trip(userId, tripId, true);
    const { count } = await this.prisma.tripAttachment.deleteMany({
      where: { id, tripId, userId },
    });
    if (!count) throw new NotFoundException("File not found");
    this.logger.log(`Trip attachment ${id} deleted`);
  }

  /** The user's trip (any status); changing files on an archived vehicle's trip is refused. */
  private async trip(userId: string, tripId: string, writable = false) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true, vehicle: true },
    });
    if (!trip) throw new NotFoundException("Trip not found");
    if (writable) assertActive(trip.vehicle);
    return trip;
  }
}
