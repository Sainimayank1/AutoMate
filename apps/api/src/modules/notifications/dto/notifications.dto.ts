import {
  createReminderSchema,
  notificationListQuerySchema,
  readAllNotificationsSchema,
  reminderListQuerySchema,
  snoozeNotificationSchema,
  updateNotificationSchema,
  updateReminderSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class NotificationListQueryDto extends createZodDto(notificationListQuerySchema) {}
export class UpdateNotificationDto extends createZodDto(updateNotificationSchema) {}
export class SnoozeNotificationDto extends createZodDto(snoozeNotificationSchema) {}
export class ReadAllNotificationsDto extends createZodDto(readAllNotificationsSchema) {}
export class ReminderListQueryDto extends createZodDto(reminderListQuerySchema) {}
export class CreateReminderDto extends createZodDto(createReminderSchema) {}
export class UpdateReminderDto extends createZodDto(updateReminderSchema) {}
