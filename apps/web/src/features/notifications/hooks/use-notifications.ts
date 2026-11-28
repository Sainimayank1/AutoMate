import type {
  CreateReminderValues,
  NotificationCategory,
  UpdateReminderValues,
} from "@automate/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  type NotificationListParams,
  notificationsService,
  type ReminderListParams,
} from "@/features/notifications/services/notifications-service";
import { formatDate } from "@/utils/format";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: NotificationListParams) => ["notifications", "list", params] as const,
  summary: ["notifications", "summary"] as const,
  reminders: (params: ReminderListParams) => ["reminders", params] as const,
};

/** What a change can touch: the inbox, the bell, reminders and the dashboard's action centre. */
function useRefresh() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: notificationKeys.all }),
      client.invalidateQueries({ queryKey: ["reminders"] }),
      client.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

export function useNotifications(params: NotificationListParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** The bell: kept fresh while the app is open. */
export function useNotificationSummary() {
  return useQuery({
    queryKey: notificationKeys.summary,
    queryFn: notificationsService.summary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSetRead() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      notificationsService.setRead(id, read),
    onSuccess: refresh,
  });
}

export function useSnooze() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) =>
      notificationsService.snooze(id, until),
    onSuccess: async () => {
      await refresh();
      toast.success("Snoozed.");
    },
  });
}

export function useDismiss() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => notificationsService.dismiss(id),
    onSuccess: refresh,
  });
}

export function useReadAll() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (category?: NotificationCategory) => notificationsService.readAll(category),
    onSuccess: refresh,
  });
}

export function useReminders(params: ReminderListParams) {
  return useQuery({
    queryKey: notificationKeys.reminders(params),
    queryFn: () => notificationsService.reminders(params),
    placeholderData: keepPreviousData,
  });
}

/** The dialog shows field errors itself. */
export function useSaveReminder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id?: string;
      values: CreateReminderValues | UpdateReminderValues;
    }) =>
      id
        ? notificationsService.updateReminder(id, values)
        : notificationsService.createReminder(values as CreateReminderValues),
    onSuccess: async (_saved, { id }) => {
      await refresh();
      toast.success(id ? "Reminder saved." : "Reminder added.");
    },
    onError: () => {},
  });
}

export function useReminderDone() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      notificationsService.setReminderDone(id, done),
    onSuccess: async (saved, { done }) => {
      await refresh();
      toast.success(
        done && saved.repeat !== "NONE"
          ? `Done. Next one on ${formatDate(saved.dueDate)}.`
          : done
            ? "Marked done."
            : "Back on your list.",
      );
    },
  });
}

export function useDeleteReminder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => notificationsService.removeReminder(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Reminder deleted.");
    },
  });
}
