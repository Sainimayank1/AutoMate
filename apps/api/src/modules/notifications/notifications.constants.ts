import { NotificationCategory, NotificationPriority, ReminderState } from "@automate/shared";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";

type Schema = ApiResponseSchemaHost["schema"];
const date = (nullable = false): Schema => ({ type: "string", format: "date-time", nullable });

/** OpenAPI shape of `NotificationItem` (@automate/shared). */
export const NOTIFICATION_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    category: { type: "string", enum: Object.values(NotificationCategory) },
    kind: { type: "string", example: "maintenance.overdue" },
    priority: { type: "string", enum: Object.values(NotificationPriority) },
    title: { type: "string", example: "Engine oil change is overdue" },
    body: { type: "string", nullable: true, example: "Due on 15 Dec 2026 or at 10,000 km" },
    href: { type: "string", nullable: true, example: "/maintenance/schedules/0190…" },
    action: {
      type: "object",
      nullable: true,
      description: "The next step, e.g. renewing an expiring document",
      properties: {
        label: { type: "string", example: "Renew" },
        href: { type: "string", example: "/documents/0190d4a2-…/edit?renew=1" },
      },
    },
    vehicle: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string", example: "Maruti Suzuki Victoris LXI" },
        registrationNumber: { type: "string", example: "HR26EV4821" },
      },
    },
    activeAt: date(),
    readAt: date(true),
    snoozedUntil: date(true),
    createdAt: date(),
  },
};

export const NOTIFICATION_SUMMARY_SCHEMA: Schema = {
  type: "object",
  properties: {
    unread: { type: "integer", example: 3 },
    latest: { type: "array", items: NOTIFICATION_SCHEMA },
  },
};

/** OpenAPI shape of `Reminder` (@automate/shared). */
export const REMINDER_SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    vehicleId: { type: "string", format: "uuid", nullable: true },
    title: { type: "string", example: "Get the tyres rotated" },
    dueDate: { type: "string", format: "date" },
    remindDaysBefore: { type: "integer", example: 1 },
    notes: { type: "string", nullable: true },
    doneAt: date(true),
    state: { type: "string", enum: Object.values(ReminderState) },
    daysLeft: { type: "integer", example: 6 },
    createdAt: date(),
    updatedAt: date(),
  },
};
