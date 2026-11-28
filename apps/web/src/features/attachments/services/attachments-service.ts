import type {
  Attachment,
  AttachmentOwner,
  CreateAttachmentUploadValues,
  FileLink,
  UploadSlot,
} from "@automate/shared";

import { request, requestAllPages } from "@/lib/api-client";

/** Files on expenses, service records, tracked parts and inspections (`/attachments`). */
export const attachmentsService = {
  /** A record holds at most MAX_ATTACHMENTS, so the whole list is small. */
  list: (owner: AttachmentOwner, ownerId: string) =>
    requestAllPages<Attachment>({ url: "/attachments", params: { owner, ownerId } }),
  link: (id: string) => request<FileLink>({ url: `/attachments/${id}/link` }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/attachments/${id}` }),
  /** Announce, PUT straight to storage, confirm. */
  async upload(owner: AttachmentOwner, ownerId: string, file: File): Promise<Attachment> {
    const announced: CreateAttachmentUploadValues = {
      owner,
      ownerId,
      fileName: file.name,
      contentType: file.type as CreateAttachmentUploadValues["contentType"],
      size: file.size,
    };
    const slot = await request<UploadSlot>({
      method: "POST",
      url: "/attachments/uploads",
      data: announced,
    });
    const put = await fetch(slot.url, { method: "PUT", headers: slot.headers, body: file });
    if (!put.ok) throw new Error("The upload didn't go through. Try again.");
    return request<Attachment>({
      method: "POST",
      url: `/attachments/uploads/${slot.fileId}/confirm`,
    });
  },
};
