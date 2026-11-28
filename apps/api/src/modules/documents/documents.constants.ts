import { DOCUMENT_FILE_TYPES, DocumentState, DocumentType } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];

const date = (example: string): Schema => ({
  type: "string",
  format: "date",
  nullable: true,
  example,
});
const text = (example: string): Schema => ({ type: "string", nullable: true, example });

/** OpenAPI shape of `DocumentFile` (@automate/shared). */
export const DOCUMENT_FILE_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    fileName: { type: "string", example: "puc-certificate.pdf" },
    contentType: { type: "string", enum: [...DOCUMENT_FILE_TYPES] },
    size: { type: "integer", example: 284512 },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** OpenAPI shape of `VehicleDocument` (@automate/shared). */
export const DOCUMENT_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
    type: { type: "string", enum: Object.values(DocumentType) },
    name: { type: "string", example: "PUC certificate" },
    number: text("HR026-PUC-9921"),
    issuer: text("Shree Balaji PUC Centre"),
    issueDate: date("2026-06-10"),
    expiryDate: date("2026-12-10"),
    notes: text("Renew at the same centre"),
    reminderDays: { type: "array", items: { type: "integer" }, example: [30, 7, 1] },
    remindOn: date("2026-12-01"),
    state: { type: "string", enum: Object.values(DocumentState) },
    daysLeft: { type: "integer", nullable: true, example: 12 },
    files: { type: "array", items: DOCUMENT_FILE_SCHEMA },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

export const DOCUMENT_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    total: { type: "integer", example: 8 },
    valid: { type: "integer", example: 5 },
    expiring: { type: "integer", example: 1 },
    expired: { type: "integer", example: 1 },
    noExpiry: { type: "integer", example: 1 },
    vehicles: { type: "integer", example: 2 },
  },
};

export const UPLOAD_SLOT_SCHEMA: Schema = {
  type: "object",
  properties: {
    fileId: { type: "string", format: "uuid" },
    url: { type: "string", description: "PUT the file here, with `headers`" },
    headers: { type: "object", additionalProperties: { type: "string" } },
    expiresAt: { type: "string", format: "date-time" },
  },
};

export const FILE_LINK_SCHEMA: Schema = {
  type: "object",
  properties: {
    url: { type: "string" },
    expiresAt: { type: "string", format: "date-time" },
  },
};
