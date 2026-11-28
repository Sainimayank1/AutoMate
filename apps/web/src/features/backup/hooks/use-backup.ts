import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { backupService } from "@/features/backup/services/backup-service";

/** A download or export: its own pending state; a failure toasts (the global handler). */
export const useDownload = (run: () => Promise<void>) => useMutation({ mutationFn: run });

/** The restore card shows these errors itself. */
export const usePreviewRestore = () =>
  useMutation({ mutationFn: backupService.preview, onError: () => {} });

export function useRestore() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: backupService.restore,
    onError: () => {},
    // New vehicles and records everywhere: every cached list is stale.
    onSuccess: async () => {
      await client.invalidateQueries();
      toast.success("Backup restored.");
    },
  });
}
