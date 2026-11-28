import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { blankToNull, optionalDate, optionalText } from "../common/fields.js";

/**
 * Documents & reminders (M6, docs/architecture/documents.md): a vehicle's papers with their dates
 * and files. Files go straight to private storage through short-lived links; the API keeps only
 * their metadata.
 */

export const DocumentType = {
  REGISTRATION: "REGISTRATION",
  INSURANCE: "INSURANCE",
  PUC: "PUC",
  DRIVING_LICENCE: "DRIVING_LICENCE",
  WARRANTY: "WARRANTY",
  ROADSIDE_ASSISTANCE: "ROADSIDE_ASSISTANCE",
  LOAN: "LOAN",
  SERVICE_INVOICE: "SERVICE_INVOICE",
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  OTHER: "OTHER",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/** Worked out from the expiry date: expiring within `EXPIRING_DAYS`, expired before today. */
export const DocumentState = {
  VALID: "VALID",
  EXPIRING: "EXPIRING",
  EXPIRED: "EXPIRED",
  /** No expiry date (an invoice, a licence without one recorded). */
  NO_EXPIRY: "NO_EXPIRY",
} as const;
export type DocumentState = (typeof DocumentState)[keyof typeof DocumentState];

export const EXPIRING_DAYS = 30;
export const DEFAULT_REMINDER_DAYS = [30, 7, 1] as const;
export const MAX_DOCUMENT_FILES = 5;

/** PDFs and photos (HEIC from iPhones), up to 10 MB each. */
export const DOCUMENT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
export type DocumentFileType = (typeof DOCUMENT_FILE_TYPES)[number];
export const MAX_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;

const day = z.preprocess(blankToNull, z.iso.date("Enter a valid date").nullable()).optional();

export const documentFieldsSchema = z.object({
  /** null for papers that aren't a vehicle's (a driving licence). */
  vehicleId: z.preprocess(blankToNull, z.uuid("Choose a vehicle").nullable()).optional(),
  type: z.enum(DocumentType, { error: "Choose a document type" }),
  name: z.string().trim().min(1, "Enter a name").max(120, "Use 120 characters or fewer"),
  number: optionalText(60),
  issuer: optionalText(120),
  issueDate: optionalDate({ pastOnly: true }),
  expiryDate: day,
  notes: optionalText(1000),
  /** Days before expiry to be reminded on. */
  reminderDays: z
    .array(
      z.coerce
        .number()
        .int()
        .min(0, "Remind 0 to 365 days ahead")
        .max(365, "Remind 0 to 365 days ahead"),
    )
    .max(5, "Choose up to 5 reminders")
    .default([...DEFAULT_REMINDER_DAYS]),
  /** A reminder on a date of the user's choosing. */
  remindOn: day,
  /** Uploaded, confirmed files to attach. */
  fileIds: z
    .array(z.uuid())
    .max(MAX_DOCUMENT_FILES, `Attach up to ${MAX_DOCUMENT_FILES} files`)
    .default([]),
});

const checkDocument = (
  value: {
    vehicleId?: string | null;
    type?: DocumentType;
    issueDate?: string | null;
    expiryDate?: string | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (value.type && value.type !== DocumentType.DRIVING_LICENCE && !value.vehicleId) {
    ctx.addIssue({ code: "custom", path: ["vehicleId"], message: "Choose a vehicle" });
  }
  if (value.issueDate && value.expiryDate && value.expiryDate < value.issueDate) {
    ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "Expires before it was issued" });
  }
};

export const createDocumentSchema = documentFieldsSchema.superRefine(checkDocument);
export type CreateDocumentValues = z.output<typeof createDocumentSchema>;
/** Merged onto the stored document and checked whole. `fileIds` replaces the attached files. */
export const updateDocumentSchema = documentFieldsSchema.partial();
export type UpdateDocumentValues = z.output<typeof updateDocumentSchema>;
export { checkDocument };

export const documentListQuerySchema = paginationQuerySchema.extend({
  vehicleId: z.uuid("Choose a vehicle").optional(),
  type: z.enum(DocumentType).optional(),
  state: z.enum(DocumentState).optional(),
  search: z.string().trim().max(100).optional(),
});
export type DocumentListQuery = z.output<typeof documentListQuerySchema>;

export const documentSummaryQuerySchema = z.object({ vehicleId: z.uuid().optional() });
export type DocumentSummaryQuery = z.output<typeof documentSummaryQuerySchema>;

export const createUploadSchema = z.object({
  fileName: z.string().trim().min(1, "Choose a file").max(200, "Use a shorter file name"),
  contentType: z.enum(DOCUMENT_FILE_TYPES, { error: "Use a PDF, JPEG, PNG, WebP or HEIC file" }),
  size: z
    .number()
    .int()
    .min(1, "The file is empty")
    .max(MAX_DOCUMENT_FILE_BYTES, "Use a file of 10 MB or less"),
});
export type CreateUploadValues = z.output<typeof createUploadSchema>;

export interface DocumentFile {
  id: string;
  fileName: string;
  contentType: DocumentFileType;
  size: number;
  createdAt: string;
}

/** Where to PUT the file (straight to storage), with the headers to send. */
export interface UploadSlot {
  fileId: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface FileLink {
  url: string;
  expiresAt: string;
}

export interface VehicleDocument {
  id: string;
  vehicleId: string | null;
  type: DocumentType;
  name: string;
  number: string | null;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  reminderDays: number[];
  remindOn: string | null;
  state: DocumentState;
  /** Days to expiry (negative once expired); null without an expiry date. */
  daysLeft: number | null;
  files: DocumentFile[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  total: number;
  valid: number;
  expiring: number;
  expired: number;
  noExpiry: number;
  /** Vehicles the documents belong to. */
  vehicles: number;
}
