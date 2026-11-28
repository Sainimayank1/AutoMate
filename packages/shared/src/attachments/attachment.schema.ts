import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { createUploadSchema, type DocumentFile } from "../documents/document.schema.js";

/**
 * Receipts, invoices, job cards and photos on an expense, a service record, a tracked part or an
 * inspection (docs/architecture/documents.md §5). Same files and limits as documents: PDF, JPEG,
 * PNG, WebP or HEIC up to 10 MB, straight to private storage.
 */
export const ATTACHMENT_OWNERS = ["expense", "service-record", "component", "inspection"] as const;
export type AttachmentOwner = (typeof ATTACHMENT_OWNERS)[number];

/** Files per record. */
export const MAX_ATTACHMENTS = 10;

const owner = {
  owner: z.enum(ATTACHMENT_OWNERS, { error: "Choose what the file belongs to" }),
  ownerId: z.uuid("Choose what the file belongs to"),
};

export const attachmentListQuerySchema = paginationQuerySchema.extend(owner);
export type AttachmentListQuery = z.output<typeof attachmentListQuerySchema>;

export const createAttachmentUploadSchema = createUploadSchema.extend(owner);
export type CreateAttachmentUploadValues = z.output<typeof createAttachmentUploadSchema>;

/** The public shape of an attached file (as a document's file). */
export type Attachment = DocumentFile;
