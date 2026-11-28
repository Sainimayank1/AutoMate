import { z } from "zod";

import { paginationQuerySchema } from "../api/pagination.js";
import { blankToNull, optionalText } from "../common/fields.js";
import { addDays, addMonths } from "../common/periods.js";

/**
 * Notifications (M10, docs/architecture/notifications.md): one in-app inbox fed by the modules'
 * own records (maintenance due, documents expiring, payments due, trip plans, mileage drops, the
 * monthly summary) and the user's own reminders. Delivered in the app; push comes later.
 */

export const NotificationCategory = {
  MAINTENANCE: "MAINTENANCE",
  DOCUMENTS: "DOCUMENTS",
  /** Recurring payments, EMIs and the monthly summary. */
  EXPENSES: "EXPENSES",
  FUEL: "FUEL",
  TRIPS: "TRIPS",
  /** The user's own reminders. */
  REMINDERS: "REMINDERS",
} as const;
export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NotificationPriority = { HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" } as const;
export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  /** What raised it, e.g. "maintenance.overdue", "document.expiring", "reminder.due". */
  kind: string;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  /** Where it opens (a path in the app). */
  href: string | null;
  /** The next step it calls for, when there's one (e.g. renewing an expiring document). */
  action: { label: string; href: string } | null;
  vehicle: { id: string; name: string; registrationNumber: string } | null;
  /** When it (re)appeared: raised, or woken from a snooze. */
  activeAt: string;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

/** The header bell: the unread count and the latest few (unread first). */
export interface NotificationSummary {
  unread: number;
  latest: NotificationItem[];
}

export const NOTIFICATION_FILTERS = ["all", "unread", "snoozed"] as const;

export const notificationListQuerySchema = paginationQuerySchema.extend({
  filter: z.enum(NOTIFICATION_FILTERS).default("all"),
  category: z.enum(NotificationCategory).optional(),
  vehicleId: z.uuid().optional(),
});
export type NotificationListQuery = z.output<typeof notificationListQuerySchema>;

export const updateNotificationSchema = z.object({ read: z.boolean() });
export type UpdateNotificationValues = z.output<typeof updateNotificationSchema>;

export const SNOOZE_MAX_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
export const snoozeNotificationSchema = z.object({
  until: z.iso
    .datetime({ offset: true, error: "Choose when to be reminded again" })
    .refine((value) => Date.parse(value) > Date.now(), "Choose a time in the future")
    .refine(
      (value) => Date.parse(value) <= Date.now() + SNOOZE_MAX_DAYS * DAY_MS,
      `Snooze for up to ${SNOOZE_MAX_DAYS} days`,
    ),
});
export type SnoozeNotificationValues = z.output<typeof snoozeNotificationSchema>;

/** The body is optional: no body marks everything read. */
export const readAllNotificationsSchema = z
  .object({ category: z.enum(NotificationCategory).optional() })
  .default({});
export type ReadAllNotificationsValues = z.output<typeof readAllNotificationsSchema>;

// ── The user's own reminders ─────────────────────────────────────────────────

export const REMINDER_LEAD_MAX_DAYS = 365;

export const ReminderRepeat = {
  NONE: "NONE",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type ReminderRepeat = (typeof ReminderRepeat)[keyof typeof ReminderRepeat];

const reminderFields = {
  /** Done on a repeating reminder moves it to its next date. */
  repeat: z.enum(ReminderRepeat, { error: "Choose how often it repeats" }),
  vehicleId: z.preprocess(blankToNull, z.uuid("Choose a vehicle").nullable()).optional(),
  title: z
    .string({ error: "Enter what to remind you about" })
    .trim()
    .min(1, "Enter what to remind you about")
    .max(120, "Use 120 characters or fewer"),
  dueDate: z.iso.date("Enter the date"),
  /** 0: on the day. */
  remindDaysBefore: z.coerce
    .number({ error: "Enter how many days before" })
    .int("Use whole days")
    .min(0, `Remind 0 to ${REMINDER_LEAD_MAX_DAYS} days before`)
    .max(REMINDER_LEAD_MAX_DAYS, `Remind 0 to ${REMINDER_LEAD_MAX_DAYS} days before`),
  notes: optionalText(1000),
};

export const createReminderSchema = z.object({
  /** Optional client-generated id (offline-sync ready). */
  id: z.uuid().optional(),
  ...reminderFields,
  remindDaysBefore: reminderFields.remindDaysBefore.default(1),
  repeat: reminderFields.repeat.default(ReminderRepeat.NONE),
});
export type CreateReminderInput = z.input<typeof createReminderSchema>;
export type CreateReminderValues = z.output<typeof createReminderSchema>;

export const updateReminderSchema = z.object(reminderFields).partial();
export type UpdateReminderValues = z.output<typeof updateReminderSchema>;

export const reminderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["open", "done"]).default("open"),
  vehicleId: z.uuid().optional(),
});
export type ReminderListQuery = z.output<typeof reminderListQuerySchema>;

/** UPCOMING: before its reminder window; DUE: in it (on or before the day); OVERDUE: after. */
export const ReminderState = {
  UPCOMING: "UPCOMING",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
  DONE: "DONE",
} as const;
export type ReminderState = (typeof ReminderState)[keyof typeof ReminderState];

export interface Reminder {
  id: string;
  vehicleId: string | null;
  title: string;
  dueDate: string;
  remindDaysBefore: number;
  repeat: ReminderRepeat;
  notes: string | null;
  doneAt: string | null;
  state: ReminderState;
  /** Days until the due date; negative once it has passed. */
  daysLeft: number;
  createdAt: string;
  updatedAt: string;
}

/** Whole days from `today` to `date` (both YYYY-MM-DD). */
export const daysBetween = (today: string, date: string) =>
  Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);

/** A reminder's state on `today` (IST date). */
export function reminderState(
  reminder: { dueDate: string; remindDaysBefore: number; doneAt: string | null },
  today: string,
): ReminderState {
  if (reminder.doneAt) return ReminderState.DONE;
  const left = daysBetween(today, reminder.dueDate);
  if (left < 0) return ReminderState.OVERDUE;
  return left <= reminder.remindDaysBefore ? ReminderState.DUE : ReminderState.UPCOMING;
}

/** A repeating reminder's next date after `dueDate`, past `today` (missed ones are skipped). */
export function nextReminderDate(dueDate: string, repeat: ReminderRepeat, today: string): string {
  if (repeat === ReminderRepeat.NONE) return dueDate;
  const step = (times: number) =>
    repeat === ReminderRepeat.WEEKLY
      ? addDays(dueDate, 7 * times)
      : addMonths(dueDate, (repeat === ReminderRepeat.MONTHLY ? 1 : 12) * times);
  let times = 1;
  let next = step(times);
  while (next < today) next = step(++times);
  return next;
}

// ── Web Push ──────────────────────────────────────────────────────────────────

/** `GET /notifications/push/config`: the server's public key, or null when push isn't set up. */
export interface PushConfig {
  publicKey: string | null;
}

/** The browser's PushSubscription, as `toJSON()` gives it. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionValues = z.output<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(2000) });
export type PushUnsubscribeValues = z.output<typeof pushUnsubscribeSchema>;

/** What a push carries to the service worker. */
export interface PushPayload {
  title: string;
  body: string | null;
  href: string;
  tag: string;
}
