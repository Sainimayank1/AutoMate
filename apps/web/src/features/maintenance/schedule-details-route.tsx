import {
  DEFAULT_REMINDER_LEAD,
  maintenanceGroupOf,
  type MaintenanceSchedule,
} from "@automate/shared";
import { cn } from "cn";
import { Pause, Pencil, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LogServiceButton } from "@/features/maintenance/components/add-schedule-button";
import { ScheduleActions } from "@/features/maintenance/components/schedule-actions";
import { DueSummary, ScheduleStatusBadge } from "@/features/maintenance/components/schedule-due";
import {
  GROUP_ICONS,
  GROUP_NAMES,
  PRIORITY_LABELS,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import {
  usePauseSchedule,
  useSchedule,
  useServiceRecords,
} from "@/features/maintenance/hooks/use-maintenance";
import { basisText, intervalText } from "@/features/maintenance/utils/schedule-text";
import { usePreferences } from "@/features/settings/hooks/use-settings";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizeApiError } from "@/lib/api-error";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Stitch "Schedule Details": a side sheet over the schedules (a bottom sheet on phones) with the
 * next due per track, how it was calculated, reminders, notes and history.
 */
export function Component() {
  const { scheduleId = "" } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const mobile = useIsMobile();
  const vehicle = useActiveVehicle().activeVehicle;
  const {
    data: schedule,
    isPending,
    error,
  } = useSchedule(vehicle?.id ?? "", scheduleId, !!vehicle);
  const pause = usePauseSchedule();

  const close = () => navigate({ pathname: "/maintenance/schedules", search });

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="w-full gap-0 overflow-y-auto max-md:max-h-[90svh] sm:max-w-md"
      >
        {isPending ? (
          <div className="flex flex-col gap-4 p-6" aria-busy>
            <SheetTitle className="sr-only">Loading schedule</SheetTitle>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !schedule ? (
          <SheetHeader>
            <SheetTitle>Schedule not found</SheetTitle>
            <SheetDescription>
              {normalizeApiError(error).status === 404
                ? "It may have been deleted, or it belongs to another vehicle."
                : normalizeApiError(error).message}
            </SheetDescription>
          </SheetHeader>
        ) : (
          <Details
            schedule={schedule}
            onDeleted={close}
            pausing={pause.isPending}
            onPause={(paused) => pause.mutate({ schedule, paused })}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Details({
  schedule,
  onDeleted,
  onPause,
  pausing,
}: {
  schedule: MaintenanceSchedule;
  onDeleted: () => void;
  onPause: (paused: boolean) => void;
  pausing: boolean;
}) {
  const group = maintenanceGroupOf(schedule.categoryKey);
  const Icon = GROUP_ICONS[group];
  const paused = schedule.pausedAt !== null;
  const timing = usePreferences().data?.reminderTiming;
  const lead = `${formatNumber(schedule.leadDays ?? timing?.serviceLeadDays ?? DEFAULT_REMINDER_LEAD.days)} days or ${formatNumber(schedule.leadKm ?? timing?.serviceLeadKm ?? DEFAULT_REMINDER_LEAD.km)} km before`;
  const both = schedule.due.date && schedule.due.distance;

  return (
    <>
      <SheetHeader className="gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ScheduleStatusBadge due={schedule.due} />
            <Badge
              variant="outline"
              className={cn(
                schedule.priority === "HIGH" &&
                  "border-transparent bg-destructive/15 text-destructive",
              )}
            >
              {PRIORITY_LABELS[schedule.priority]} priority
            </Badge>
          </div>
        </div>
        <SheetTitle className="text-lg">{schedule.name}</SheetTitle>
        <SheetDescription>{GROUP_NAMES[group]}</SheetDescription>
      </SheetHeader>

      <div className={cn("flex flex-col gap-4 px-4 pb-4", paused && "opacity-80")}>
        {paused && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Paused · not counted as due</span>
            <Button size="sm" variant="outline" disabled={pausing} onClick={() => onPause(false)}>
              <Play data-icon="inline-start" />
              Resume
            </Button>
          </div>
        )}
        <Block title="Next due">
          <DueSummary schedule={schedule} />
          {both && <p className="text-xs text-muted-foreground">Whichever comes first</p>}
        </Block>
        <Block title="How it's calculated">
          <p className="text-sm tabular-nums">{intervalText(schedule)}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{basisText(schedule)}</p>
        </Block>
        <Block title="Reminders">
          <p className="text-sm">
            {schedule.remindersEnabled ? `On · ${lead}` : `Off · due soon ${lead}`}
          </p>
        </Block>
        {schedule.notes && (
          <Block title="Notes">
            <p className="text-sm whitespace-pre-line">{schedule.notes}</p>
          </Block>
        )}
        <Block title="History">
          <History schedule={schedule} />
        </Block>
      </div>

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
        {!paused && (
          <Button variant="ghost" disabled={pausing} onClick={() => onPause(true)}>
            <Pause data-icon="inline-start" />
            Pause
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to={`/maintenance/schedules/${schedule.id}/edit`}>
            <Pencil data-icon="inline-start" />
            Edit
          </Link>
        </Button>
        <LogServiceButton scheduleId={schedule.id} label="Mark completed" />
        <ScheduleActions schedule={schedule} showView={false} onDeleted={onDeleted} />
      </SheetFooter>
    </>
  );
}

/** The services that completed this schedule, newest first (its countdown restarted from each). */
function History({ schedule }: { schedule: MaintenanceSchedule }) {
  const records = useServiceRecords(schedule.vehicleId, { scheduleId: schedule.id, pageSize: 10 });
  if (records.isPending) return <Skeleton className="h-10 w-full" />;
  const items = records.data?.items ?? [];
  if (!items.length) {
    return (
      <p className={cn("text-sm", TONE_TEXT.neutral)}>
        Completions appear here when you log a service for this schedule.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((record) => (
        <li key={record.id}>
          <Link
            to={`/maintenance/records/${record.vehicleId}/${record.id}`}
            className="flex justify-between gap-3 rounded-md py-1.5 text-sm hover:underline"
          >
            <span className="truncate">{record.title}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {[
                formatDate(record.serviceDate),
                record.odometerKm !== null && formatDistance(record.odometerKm),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
