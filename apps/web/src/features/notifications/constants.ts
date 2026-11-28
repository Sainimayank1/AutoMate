import {
  NotificationCategory,
  NotificationPriority,
  ReminderRepeat,
  ReminderState,
} from "@automate/shared";
import { formatDistanceToNowStrict } from "date-fns";
import {
  CalendarClock,
  FileText,
  Fuel,
  type LucideIcon,
  ReceiptIndianRupee,
  Route,
  Wrench,
} from "lucide-react";

import type { StatusTone } from "@/components/common/status-badge";

export const CATEGORY_META: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  [NotificationCategory.MAINTENANCE]: { label: "Maintenance", icon: Wrench },
  [NotificationCategory.DOCUMENTS]: { label: "Documents", icon: FileText },
  [NotificationCategory.EXPENSES]: { label: "Expenses", icon: ReceiptIndianRupee },
  [NotificationCategory.FUEL]: { label: "Fuel", icon: Fuel },
  [NotificationCategory.TRIPS]: { label: "Trips", icon: Route },
  [NotificationCategory.REMINDERS]: { label: "Reminders", icon: CalendarClock },
};

/** The icon tile and border by priority (High destructive, Medium warning, Low muted). */
export const PRIORITY_META: Record<
  NotificationPriority,
  { label: string; tile: string; border: string }
> = {
  [NotificationPriority.HIGH]: {
    label: "Urgent",
    tile: "bg-destructive/15 text-destructive",
    border: "border-destructive/50",
  },
  [NotificationPriority.MEDIUM]: {
    label: "Soon",
    tile: "bg-warning/15 text-warning",
    border: "border-warning/50",
  },
  [NotificationPriority.LOW]: { label: "For later", tile: "bg-muted text-primary", border: "" },
};

export const REMINDER_STATE: Record<ReminderState, { tone: StatusTone; tile: string }> = {
  [ReminderState.OVERDUE]: { tone: "destructive", tile: "bg-destructive/15 text-destructive" },
  [ReminderState.DUE]: { tone: "warning", tile: "bg-warning/15 text-warning" },
  [ReminderState.UPCOMING]: { tone: "neutral", tile: "bg-muted text-muted-foreground" },
  [ReminderState.DONE]: { tone: "success", tile: "bg-success/15 text-success" },
};

/** "Remind me" choices in days before. */
export const REPEAT_LABELS: Record<ReminderRepeat, string> = {
  [ReminderRepeat.NONE]: "Doesn't repeat",
  [ReminderRepeat.WEEKLY]: "Every week",
  [ReminderRepeat.MONTHLY]: "Every month",
  [ReminderRepeat.YEARLY]: "Every year",
};

export const LEAD_OPTIONS = [
  { days: 0, label: "On the day" },
  { days: 1, label: "1 day before" },
  { days: 3, label: "3 days before" },
  { days: 7, label: "1 week before" },
  { days: 14, label: "2 weeks before" },
  { days: 30, label: "1 month before" },
] as const;

/** "2 hours ago" */
export const relativeTime = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
