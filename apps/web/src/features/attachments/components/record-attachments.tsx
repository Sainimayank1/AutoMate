import { type AttachmentOwner, MAX_ATTACHMENTS } from "@automate/shared";

import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";
import {
  useAttachmentMutations,
  useAttachments,
} from "@/features/attachments/hooks/use-attachments";
import { attachmentsService } from "@/features/attachments/services/attachments-service";
import { normalizeApiError } from "@/lib/api-error";

/**
 * The shared photos-and-receipts panel bound to one record (an expense's receipt, a service
 * record's invoice or job card, a part's warranty card, an inspection's photos).
 */
export function RecordAttachments({
  owner,
  ownerId,
  title,
  readOnly,
}: {
  owner: AttachmentOwner;
  ownerId: string;
  title: string;
  readOnly?: boolean;
}) {
  const files = useAttachments(owner, ownerId);
  const { upload, remove } = useAttachmentMutations(owner, ownerId);
  return (
    <AttachmentsPanel
      title={title}
      items={files.data}
      error={files.isError ? normalizeApiError(files.error).message : null}
      max={MAX_ATTACHMENTS}
      readOnly={readOnly}
      onUpload={(file) => upload.mutateAsync(file)}
      onOpen={async (item) => (await attachmentsService.link(item.id)).url}
      onPreview={async (item) =>
        (await attachmentsService.link(item.id, item.thumbnail ? "thumb" : undefined)).url
      }
      onRemove={(item) => remove.mutateAsync(item.id)}
    />
  );
}
