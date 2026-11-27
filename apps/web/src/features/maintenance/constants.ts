import {
  type ComponentCondition,
  type ComponentStatus,
  type InspectionCondition,
  type InspectionKind,
  MAINTENANCE_GROUPS,
  type MaintenanceGroupKey,
  MaintenanceState,
  type ProviderType,
  SchedulePriority,
  ScheduleStatus,
  type ServiceRecordType,
} from "@automate/shared";
import {
  Activity,
  Battery,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Disc3,
  Droplet,
  Fan,
  Hammer,
  Info,
  type LucideIcon,
  PackageCheck,
  PackageMinus,
  Paintbrush,
  Pause,
  ScanSearch,
  Settings2,
  Snowflake,
  Sparkle,
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

/** Component status → label, tone, icon (color-system.md "Maintenance" mapping). */
export const COMPONENT_STATUS_META: Record<
  ComponentStatus,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  NEW: { label: "New", tone: "info", icon: Sparkle },
  GOOD: { label: "Good", tone: "success", icon: CircleCheck },
  MONITORING: { label: "Monitoring", tone: "warning", icon: Activity },
  INSPECTION_DUE: { label: "Inspection due", tone: "warning", icon: ScanSearch },
  REPLACEMENT_APPROACHING: {
    label: "Replacement approaching",
    tone: "destructive",
    icon: CircleAlert,
  },
  REPLACED: { label: "Replaced", tone: "neutral", icon: PackageCheck },
  FAILED: { label: "Failed", tone: "destructive", icon: CircleX },
  REMOVED: { label: "Removed", tone: "neutral", icon: PackageMinus },
  UNKNOWN: { label: "Unknown", tone: "neutral", icon: CircleDashed },
};

export const CONDITION_LABELS: Record<ComponentCondition, string> = {
  NEW: "New",
  GOOD: "Good",
  MONITORING: "Needs monitoring",
  NEEDS_ATTENTION: "Needs attention",
  REPLACE_SOON: "Replace soon",
  FAILED: "Failed",
  UNKNOWN: "Unknown / not inspected",
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

/** Inspection finding → label and tone (the Stitch checklist's condition colours). */
export const INSPECTION_CONDITION_META: Record<InspectionCondition, { label: string; tone: Tone }> =
  {
    GOOD: { label: "Good", tone: "success" },
    NORMAL: { label: "Normal", tone: "success" },
    MONITOR: { label: "Monitor", tone: "info" },
    ATTENTION: { label: "Attention", tone: "warning" },
    REPLACE_SOON: { label: "Replace soon", tone: "destructive" },
    REPLACED: { label: "Replaced", tone: "neutral" },
    NOT_INSPECTED: { label: "Not inspected", tone: "neutral" },
  };

export const INSPECTION_KIND_LABELS: Record<InspectionKind, string> = {
  SELF_CHECK: "Your check",
  PROFESSIONAL: "Professional",
};

/** A flagged finding's card border. */
export const TONE_BORDER: Record<Tone, string> = {
  destructive: "border-destructive/40",
  warning: "border-warning/40",
  info: "border-info/40",
  success: "border-success/40",
  neutral: "border-border",
};

/** A tinted control or chip in a tone (the condition select, condition chips). */
export const TONE_SOFT: Record<Tone, string> = {
  destructive: "border-destructive/30 bg-destructive/15 text-destructive",
  warning: "border-warning/30 bg-warning/15 text-warning",
  info: "border-info/30 bg-info/15 text-info",
  success: "border-success/30 bg-success/15 text-success",
  neutral: "bg-muted text-muted-foreground",
};

/** A flagged finding's left accent (summary lists). */
export const TONE_ACCENT: Record<Tone, string> = {
  destructive: "border-l-destructive",
  warning: "border-l-warning",
  info: "border-l-info",
  success: "border-l-success",
  neutral: "border-l-border",
};

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  AUTHORISED: "Authorised service centre",
  INDEPENDENT: "Multi-brand garage",
  TYRES: "Tyre shop",
  BATTERY: "Battery shop",
  BODY_SHOP: "Body shop",
  DETAILING: "Detailing",
  ROADSIDE: "Roadside help",
  OTHER: "Other",
};
