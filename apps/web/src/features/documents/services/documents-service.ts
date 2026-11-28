import type {
  CreateDocumentValues,
  CreateUploadValues,
  DocumentFile,
  DocumentListQuery,
  DocumentSummary,
  FileLink,
  UpdateDocumentValues,
  UploadSlot,
  VehicleDocument,
} from "@automate/shared";

import { request, requestPage } from "@/lib/api-client";
import { shrinkImage } from "@/utils/image";

/** Documents and their files (M6). Files go straight to storage; the API only signs the way. */
export const documentsService = {
  list: (params: Partial<DocumentListQuery>) =>
    requestPage<VehicleDocument>({ url: "/documents", params }),
  summary: (vehicleId: string | undefined) =>
    request<DocumentSummary>({ url: "/documents/summary", params: { vehicleId } }),
  get: (id: string) => request<VehicleDocument>({ url: `/documents/${id}` }),
  create: (values: CreateDocumentValues) =>
    request<VehicleDocument>({ method: "POST", url: "/documents", data: values }),
  update: (id: string, values: UpdateDocumentValues) =>
    request<VehicleDocument>({ method: "PATCH", url: `/documents/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/documents/${id}` }),
  fileLink: (id: string, fileId: string) =>
    request<FileLink>({ url: `/documents/${id}/files/${fileId}/link` }),

  /** Announce, PUT straight to storage (no API credentials go there), confirm. */
  async upload(original: File): Promise<DocumentFile> {
    const file = await shrinkImage(original);
    const announced: CreateUploadValues = {
      fileName: file.name,
      contentType: file.type as CreateUploadValues["contentType"],
      size: file.size,
    };
    const slot = await request<UploadSlot>({
      method: "POST",
      url: "/documents/uploads",
      data: announced,
    });
    const put = await fetch(slot.url, { method: "PUT", headers: slot.headers, body: file });
    if (!put.ok) throw new Error("The upload didn't go through. Try again.");
    return request<DocumentFile>({
      method: "POST",
      url: `/documents/uploads/${slot.fileId}/confirm`,
    });
  },
};
