import type {
  CreateReminderValues,
  NotificationCategory,
  NotificationItem,
  NotificationListQuery,
  NotificationSummary,
  PushConfig,
  PushSubscriptionValues,
  Reminder,
  ReminderListQuery,
  UpdateReminderValues,
} from "@automate/shared";

import { request, requestPage } from "@/lib/api-client";

export type NotificationListParams = Partial<NotificationListQuery>;
export type ReminderListParams = Partial<ReminderListQuery>;

/** Notifications (M10): the inbox, its bell and the user's own reminders. */
export const notificationsService = {
  list: (params: NotificationListParams) =>
    requestPage<NotificationItem>({ url: "/notifications", params }),
  summary: () => request<NotificationSummary>({ url: "/notifications/summary" }),
  setRead: (id: string, read: boolean) =>
    request<NotificationItem>({ method: "PATCH", url: `/notifications/${id}`, data: { read } }),
  snooze: (id: string, until: string) =>
    request<NotificationItem>({
      method: "POST",
      url: `/notifications/${id}/snooze`,
      data: { until },
    }),
  dismiss: (id: string) => request<void>({ method: "DELETE", url: `/notifications/${id}` }),
  readAll: (category?: NotificationCategory) =>
    request<{ updated: number }>({
      method: "POST",
      url: "/notifications/read-all",
      data: category ? { category } : {},
    }),

  pushConfig: () => request<PushConfig>({ url: "/notifications/push/config" }),
  subscribePush: (subscription: PushSubscriptionValues) =>
    request<void>({ method: "POST", url: "/notifications/push/subscriptions", data: subscription }),
  unsubscribePush: (endpoint: string) =>
    request<void>({ method: "POST", url: "/notifications/push/unsubscribe", data: { endpoint } }),

  reminders: (params: ReminderListParams) => requestPage<Reminder>({ url: "/reminders", params }),
  createReminder: (values: CreateReminderValues) =>
    request<Reminder>({ method: "POST", url: "/reminders", data: values }),
  updateReminder: (id: string, values: UpdateReminderValues) =>
    request<Reminder>({ method: "PATCH", url: `/reminders/${id}`, data: values }),
  setReminderDone: (id: string, done: boolean) =>
    request<Reminder>({ method: "POST", url: `/reminders/${id}/${done ? "done" : "reopen"}` }),
  removeReminder: (id: string) => request<void>({ method: "DELETE", url: `/reminders/${id}` }),
};
