import type { MaintenanceSchedule, ScheduleDue } from "@automate/shared";
import { cn } from "cn";

import { StatusBadge } from "@/components/common/status-badge";
import { Progress } from "@/components/ui/progress";
import { SCHEDULE_STATUS_META, TONE_PROGRESS, TONE_TEXT } from "@/features/maintenance/constants";
import { dueLines, progressOf } from "@/features/maintenance/utils/schedule-text";

export function ScheduleStatusBadge({ due }: { due: ScheduleDue }) {
  const meta = SCHEDULE_STATUS_META[due.status];
  return <StatusBadge tone={meta.tone} icon={meta.icon} label={meta.label} />;
}

/** Due lines (deciding one emphasised) and, for repeating schedules, a thin progress track. */
export function DueSummary({
  schedule,
  className,
}: {
  schedule: MaintenanceSchedule;
  className?: string;
}) {
  const [first, ...rest] = dueLines(schedule.due);
  const tone = SCHEDULE_STATUS_META[schedule.due.status].tone;
  const progress = progressOf(schedule);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm text-muted-foreground tabular-nums">
        <span className={cn(schedule.due.status === "OVERDUE" && TONE_TEXT.destructive)}>
          {first}
        </span>
        {rest.map((line) => (
          <span key={line} className="text-muted-foreground/80">
            {" "}
            · or {line.charAt(0).toLowerCase() + line.slice(1)}
          </span>
        ))}
      </p>
      {progress !== null && (
        <Progress
          value={Math.round(Math.min(1, Math.max(0, progress)) * 100)}
          aria-label="Interval used"
          className={cn("h-1.5", TONE_PROGRESS[tone])}
        />
      )}
    </div>
  );
}
