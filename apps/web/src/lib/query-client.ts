import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { type ApiError, isRetryableError, normalizeApiError } from "@/lib/api-error";

declare module "@tanstack/react-query" {
  interface Register {
    // All query/mutation functions go through apiClient, which only rejects with ApiError.
    defaultError: ApiError;
  }
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // First-load failures render an in-page ErrorState; only toast when stale data is already on screen.
        if (query.state.data !== undefined) toast.error(normalizeApiError(error).message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        // A mutation with its own onError (e.g. mapping field errors onto a form) handles it itself.
        if (!mutation.options.onError) toast.error(normalizeApiError(error).message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Writes are not idempotent; never replay them automatically.
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
