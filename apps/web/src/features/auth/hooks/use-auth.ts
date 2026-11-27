import type { AuthSession } from "@automate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authService } from "@/features/auth/services/auth-service";
import { useSessionStore } from "@/stores/session-store";

/** Stores the new session. RequireGuest then redirects away from the auth pages. */
function useStartSession() {
  const queryClient = useQueryClient();
  return ({ user, accessToken }: AuthSession) => {
    queryClient.clear(); // never show a previous user's cached data
    useSessionStore.getState().setSession({ user, accessToken });
  };
}

// The forms show errors inline (applyServerErrors), so these mutations opt out of the global toast.
const handledByForm = () => {};

export function useLogin() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: authService.login,
    onSuccess: startSession,
    onError: handledByForm,
  });
}

export function useRegister() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: authService.register,
    onSuccess: (session) => {
      startSession(session);
      toast.success(`Welcome to AutoMate, ${session.user.name.split(" ")[0]}.`);
    },
    onError: handledByForm,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authService.logout,
    // Sign out locally even if the request fails (e.g. offline); RequireAuth then shows the sign-in page.
    onSettled: () => {
      useSessionStore.getState().clearSession();
      queryClient.clear();
    },
    onError: () => {},
  });
}
