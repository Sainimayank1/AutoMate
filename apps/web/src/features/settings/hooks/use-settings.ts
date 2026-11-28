import type { UpdatePreferencesValues, UserProfile } from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { settingsService } from "@/features/settings/services/settings-service";
import { useSessionStore } from "@/stores/session-store";

export const settingsKeys = {
  preferences: ["settings", "preferences"] as const,
  sessions: (page: number) => ["settings", "sessions", page] as const,
};

/** The signed-in user changed: the header and menus read it from the session. */
function setUser(user: UserProfile) {
  const session = useSessionStore.getState().session;
  if (session) useSessionStore.getState().setSession({ ...session, user });
}

export function usePreferences() {
  return useQuery({
    queryKey: settingsKeys.preferences,
    queryFn: settingsService.preferences,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdatePreferencesValues) => settingsService.updatePreferences(values),
    onSuccess: (saved) => client.setQueryData(settingsKeys.preferences, saved),
  });
}

/** Forms show their errors inline. */
export const useUpdateProfile = () =>
  useMutation({
    mutationFn: settingsService.updateProfile,
    onSuccess: (user) => {
      setUser(user);
      toast.success("Profile saved.");
    },
    onError: () => {},
  });

export const useUploadAvatar = () =>
  useMutation({
    mutationFn: (file: File) => settingsService.uploadAvatar(file),
    onSuccess: (user) => {
      setUser(user);
      toast.success("Photo updated.");
    },
  });

export const useRemoveAvatar = () =>
  useMutation({
    mutationFn: settingsService.removeAvatar,
    onSuccess: (user) => {
      setUser(user);
      toast.success("Photo removed.");
    },
  });

export const useChangePassword = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: settingsService.changePassword,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings", "sessions"] });
      toast.success("Password changed. Your other devices are signed out.");
    },
    onError: () => {},
  });
};

export function useSessions(page: number) {
  return useQuery({
    queryKey: settingsKeys.sessions(page),
    queryFn: () => settingsService.sessions({ page, pageSize: 10 }),
    placeholderData: (previous) => previous,
  });
}

export const useRevokeSession = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => settingsService.revokeSession(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings", "sessions"] });
      toast.success("Device signed out.");
    },
  });
};

export const useRevokeOthers = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: settingsService.revokeOthers,
    onSuccess: async ({ signedOut }) => {
      await client.invalidateQueries({ queryKey: ["settings", "sessions"] });
      toast.success(
        signedOut
          ? `${signedOut} device${signedOut === 1 ? "" : "s"} signed out.`
          : "No other devices were signed in.",
      );
    },
  });
};

/** Gone for good: the session ends here too. */
export const useDeleteAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: settingsService.deleteAccount,
    onSuccess: () => {
      useSessionStore.getState().clearSession();
      client.clear();
    },
    onError: () => {},
  });
};
