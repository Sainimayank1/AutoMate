import type { DocumentFileType, VehicleDocument } from "@automate/shared";

import type { Prisma } from "@/generated/prisma/client";

import { documentState } from "./document-state";

export const DOCUMENT_WITH = {
  files: { where: { confirmedAt: { not: null } }, orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.DocumentInclude;
export type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof DOCUMENT_WITH }>;
type FileRow = DocumentRow["files"][number];

export const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export const toDocumentFile = (row: FileRow) => ({
  id: row.id,
  fileName: row.fileName,
  contentType: row.contentType as DocumentFileType,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
});

export function toDocument(row: DocumentRow, today: string): VehicleDocument {
  const expiryDate = day(row.expiryDate);
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    type: row.type,
    name: row.name,
    number: row.number,
    issuer: row.issuer,
    issueDate: day(row.issueDate),
    expiryDate,
    notes: row.notes,
    reminderDays: row.reminderDays,
    remindOn: day(row.remindOn),
    ...documentState(expiryDate, today),
    files: row.files.map(toDocumentFile),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The stored document as create input, to merge an update onto. */
export const toDocumentInput = (row: DocumentRow) => ({
  vehicleId: row.vehicleId,
  type: row.type,
  name: row.name,
  number: row.number,
  issuer: row.issuer,
  issueDate: day(row.issueDate),
  expiryDate: day(row.expiryDate),
  notes: row.notes,
  reminderDays: row.reminderDays,
  remindOn: day(row.remindOn),
  fileIds: row.files.map((file) => file.id),
});
