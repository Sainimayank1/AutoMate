import type { AttachmentOwner } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { attachmentsService } from "@/features/attachments/services/attachments-service";

export const attachmentKeys = {
  list: (owner: AttachmentOwner, ownerId: string) => ["attachments", owner, ownerId] as const,
};

export function useAttachments(owner: AttachmentOwner, ownerId: string | undefined) {
  return useQuery({
    queryKey: attachmentKeys.list(owner, ownerId ?? ""),
    queryFn: () => attachmentsService.list(owner, ownerId!),
    enabled: !!ownerId,
  });
}

/** The panel shows upload and removal errors on the file itself. */
export function useAttachmentMutations(owner: AttachmentOwner, ownerId: string) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: attachmentKeys.list(owner, ownerId) });
  const upload = useMutation({
    mutationFn: (file: File) => attachmentsService.upload(owner, ownerId, file),
    onSuccess: refresh,
    onError: () => {},
  });
  const remove = useMutation({
    mutationFn: (id: string) => attachmentsService.remove(id),
    onSuccess: refresh,
    onError: () => {},
  });
  return { upload, remove };
}
