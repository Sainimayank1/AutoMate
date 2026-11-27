import {
  MAINTENANCE_GROUPS,
  type MaintenanceGroupKey,
  MaintenanceState,
  SchedulePriority,
  ScheduleStatus,
  type ServiceRecordType,
} from "@automate/shared";
import {
  Battery,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  Disc3,
  Droplet,
  Fan,
  Hammer,
  Info,
  type LucideIcon,
  Paintbrush,
  Pause,
  Settings2,
  Snowflake,
  Thermometer,
  Wrench,
} from "lucide-react";

import type { StatusTone } from "@/components/common/status-badge";

export type Tone = StatusTone;

export const TONE_TEXT: Record<Tone, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  success: "text-success",
  neutral: "text-muted-foreground",
};

export const TONE_PROGRESS: Record<Tone, string> = {
  destructive: "[&>[data-slot=progress-indicator]]:bg-destructive",
  warning: "[&>[data-slot=progress-indicator]]:bg-warning",
  info: "[&>[data-slot=progress-indicator]]:bg-info",
  success: "[&>[data-slot=progress-indicator]]:bg-success",
  neutral: "[&>[data-slot=progress-indicator]]:bg-muted-foreground",
};

/** Schedule status → label, tone, icon (color-system.md "Maintenance" mapping). */
export const SCHEDULE_STATUS_META: Record<
  ScheduleStatus,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  [ScheduleStatus.OVERDUE]: { label: "Overdue", tone: "destructive", icon: CircleAlert },
  [ScheduleStatus.DUE]: { label: "Due", tone: "warning", icon: CalendarClock },
  [ScheduleStatus.DUE_SOON]: { label: "Due soon", tone: "info", icon: Clock },
  [ScheduleStatus.UPCOMING]: { label: "Upcoming", tone: "info", icon: CalendarDays },
  [ScheduleStatus.UP_TO_DATE]: { label: "Up to date", tone: "success", icon: CircleCheck },
  [ScheduleStatus.PAUSED]: { label: "Paused", tone: "neutral", icon: Pause },
  [ScheduleStatus.COMPLETED]: { label: "Completed", tone: "neutral", icon: CircleCheck },
  [ScheduleStatus.NOT_CONFIGURED]: { label: "Not configured", tone: "neutral", icon: CircleDashed },
};

/** The overview's one-line state. Never a health claim. */
export const STATE_META: Record<MaintenanceState, { title: string; tone: Tone; icon: LucideIcon }> =
  {
    [MaintenanceState.OVERDUE]: {
      title: "Overdue maintenance",
      tone: "destructive",
      icon: CircleAlert,
    },
    [MaintenanceState.ATTENTION]: {
      title: "Attention required",
      tone: "warning",
      icon: CalendarClock,
    },
    [MaintenanceState.UPCOMING]: { title: "Upcoming maintenance", tone: "info", icon: Clock },
    [MaintenanceState.ALL_CAUGHT_UP]: {
      title: "All caught up",
      tone: "success",
      icon: CircleCheck,
    },
    [MaintenanceState.INCOMPLETE]: {
      title: "Maintenance data incomplete",
      tone: "neutral",
      icon: Info,
    },
  };

export const RECORD_TYPE_LABELS: Record<ServiceRecordType, string> = {
  ROUTINE_SERVICE: "Routine service",
  PREVENTIVE: "Preventive maintenance",
  INSPECTION: "Inspection",
  REPAIR: "Repair",
  COMPONENT_REPLACEMENT: "Component replacement",
  EMERGENCY_REPAIR: "Emergency repair",
  WARRANTY_REPAIR: "Warranty repair",
  MODIFICATION: "Modification / upgrade",
  OTHER: "Other",
};

export const PRIORITY_LABELS: Record<SchedulePriority, string> = {
  [SchedulePriority.LOW]: "Low",
  [SchedulePriority.NORMAL]: "Normal",
  [SchedulePriority.HIGH]: "High",
};

/** One icon per maintenance group (module-design-guidelines.md M05). */
export const GROUP_ICONS: Record<MaintenanceGroupKey, LucideIcon> = {
  ENGINE: Droplet,
  TRANSMISSION: Settings2,
  BRAKES: Disc3,
  TYRES: CircleDot,
  ELECTRICAL: Battery,
  COOLING: Thermometer,
  AC: Snowflake,
  SUSPENSION: Fan,
  GENERAL: Wrench,
  BODY: Paintbrush,
  REPAIRS: Hammer,
  OTHER: Wrench,
};

export const GROUP_NAMES = Object.fromEntries(
  MAINTENANCE_GROUPS.map((group) => [group.key, group.name]),
) as Record<MaintenanceGroupKey, string>;
