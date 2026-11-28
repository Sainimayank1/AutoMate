import type { CreateTransferValues, TransferDirection } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { transfersService } from "@/features/garage/services/transfers-service";

export const transferKeys = {
  all: ["vehicle-transfers"] as const,
  list: (direction: TransferDirection) => ["vehicle-transfers", direction] as const,
};

/** The first page: a person has a handful of transfers at most. */
export function useTransfers(direction: TransferDirection) {
  return useQuery({
    queryKey: transferKeys.list(direction),
    queryFn: () => transfersService.list(direction),
  });
}

export function useOfferTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateTransferValues) => transfersService.offer(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transferKeys.all }),
    // The dialog shows the error by its field.
    onError: () => {},
  });
}

/** Accept moves a whole vehicle in: every list may change, so everything is refetched. */
export function useTransferAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" | "cancel" }) =>
      transfersService.act(id, action),
    onSuccess: (_, { action }) =>
      action === "accept"
        ? queryClient.invalidateQueries()
        : queryClient.invalidateQueries({ queryKey: transferKeys.all }),
    onError: () => {},
  });
}
