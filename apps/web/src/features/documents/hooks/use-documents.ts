import type {
  CreateDocumentValues,
  DocumentListQuery,
  UpdateDocumentValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { documentsService } from "@/features/documents/services/documents-service";

export const documentKeys = {
  all: ["documents"] as const,
  list: (params: Partial<DocumentListQuery>) => ["documents", "list", params] as const,
  summary: (vehicleId: string | undefined) => ["documents", "summary", vehicleId ?? "all"] as const,
  detail: (id: string) => ["documents", "detail", id] as const,
};

export function useDocuments(params: Partial<DocumentListQuery>, enabled = true) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentsService.list(params),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useDocumentSummary(vehicleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: documentKeys.summary(vehicleId),
    queryFn: () => documentsService.summary(vehicleId),
    enabled,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: documentKeys.detail(id!),
    queryFn: () => documentsService.get(id!),
    enabled: !!id,
  });
}

/** Documents feed the dashboard (expiries, status), so a write refreshes it too. */
function useDocumentWrite<TArgs, TResult>(
  run: (args: TArgs) => Promise<TResult>,
  done: string,
  form = false,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: documentKeys.all }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(done);
    },
    // Forms show their errors inline.
    ...(form ? { onError: () => {} } : {}),
  });
}

export const useCreateDocument = () =>
  useDocumentWrite(
    (values: CreateDocumentValues) => documentsService.create(values),
    "Document saved.",
    true,
  );

export const useUpdateDocument = (id: string) =>
  useDocumentWrite(
    (values: UpdateDocumentValues) => documentsService.update(id, values),
    "Document updated.",
    true,
  );

export const useDeleteDocument = () =>
  useDocumentWrite((id: string) => documentsService.remove(id), "Document deleted.");

/** One file to storage and back confirmed; the form shows the error by the file. */
export const useUploadFile = () =>
  useMutation({ mutationFn: (file: File) => documentsService.upload(file), onError: () => {} });

/** A short-lived link to show a file; refreshed before it expires (links last 5 minutes). */
export function useFileLink(documentId: string, fileId: string) {
  return useQuery({
    queryKey: ["documents", "link", documentId, fileId] as const,
    queryFn: () => documentsService.fileLink(documentId, fileId),
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
  });
}

/** Opens a file in a new tab through a short-lived link. */
export function useOpenFile() {
  return useMutation({
    mutationFn: async ({ documentId, fileId }: { documentId: string; fileId: string }) => {
      // Opened before the await, so popup blockers see the click.
      const tab = window.open("", "_blank");
      const link = await documentsService.fileLink(documentId, fileId);
      if (tab) tab.location.href = link.url;
      else window.location.assign(link.url);
    },
  });
}
