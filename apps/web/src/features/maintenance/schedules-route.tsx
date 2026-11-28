import { maintenanceGroupOf, type MaintenanceSchedule, ScheduleStatus } from "@automate/shared";
import { cn } from "cn";
import { CalendarPlus, Car, SearchX } from "lucide-react";
import { useDeferredValue } from "react";
import { Link, Outlet, useNavigate, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import {
  AddScheduleButton,
  LogServiceButton,
} from "@/features/maintenance/components/add-schedule-button";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { ScheduleActions } from "@/features/maintenance/components/schedule-actions";
import { ScheduleStatusBadge } from "@/features/maintenance/components/schedule-due";
import {
  GROUP_ICONS,
  GROUP_NAMES,
  SCHEDULE_STATUS_META,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import { useMaintenanceOverview, useSchedules } from "@/features/maintenance/hooks/use-maintenance";
import { basisText, dueLines, intervalText } from "@/features/maintenance/utils/schedule-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDistance, formatNumber } from "@/utils/format";

/** Filter chips in Stitch order; NOT_CONFIGURED never happens with valid schedules. */
const CHIPS = [
  ScheduleStatus.OVERDUE,
  ScheduleStatus.DUE,
  ScheduleStatus.DUE_SOON,
  ScheduleStatus.UPCOMING,
  ScheduleStatus.UP_TO_DATE,
  ScheduleStatus.PAUSED,
  ScheduleStatus.COMPLETED,
] as const;

const isStatus = (value: string | null): value is ScheduleStatus =>
  !!value && (Object.values(ScheduleStatus) as string[]).includes(value);

/**
 * Stitch "Maintenance Schedules — Desktop / Mobile": the planner. Status chips (counts from the
 * overview), search, the vehicle's schedules most urgent first, a page at a time. Filters live in
 * the URL; the details sheet renders in the <Outlet/>.
 * Deviations: due soon / upcoming use the
 * `info` tone, not the primary accent (color-system.md: cyan is never a status colour).
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = isStatus(params.get("status"))
    ? (params.get("status") as ScheduleStatus)
    : undefined;
  const search = params.get("search") ?? "";
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const overview = useMaintenanceOverview(vehicle?.id);
  const list = useSchedules(vehicle?.id, {
    page,
    ...(status && { status }),
    ...(deferredSearch && { search: deferredSearch }),
  });

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in changes)) next.delete("page");
        return next;
      },
      { replace: true },
    );

  if (!garage.isPending && !vehicle) {
    return (
      <MaintenanceLayout tab="schedules">
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Car}
          title="Add a vehicle first"
          description="Maintenance is tracked per vehicle in your garage."
          action={
            <Button asChild>
              <Link to="/garage/new">Add vehicle</Link>
            </Button>
          }
        />
      </MaintenanceLayout>
    );
  }

  const counts = overview.data?.counts;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;
  const filtered = !!status || !!search;
  const items = list.data?.items;

  return (
    <MaintenanceLayout
      tab="schedules"
      description={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      actions={
        vehicle && (
          <>
            <LogServiceButton variant="outline" />
            <AddScheduleButton />
          </>
        )
      }
    >
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
          role="group"
          aria-label="Filter schedules by status"
        >
          <Chip
            active={!status}
            onClick={() => update({ status: null })}
            label="All"
            count={total}
          />
          {CHIPS.map((chip) => (
            <Chip
              key={chip}
              active={status === chip}
              onClick={() => update({ status: chip })}
              label={SCHEDULE_STATUS_META[chip].label}
              count={counts?.[chip]}
              tone={TONE_TEXT[SCHEDULE_STATUS_META[chip].tone]}
            />
          ))}
        </div>
        <SearchInput
          value={search}
          onValueChange={(value) => update({ search: value || null })}
          placeholder="Search schedules"
          aria-label="Search schedules"
          className="w-full sm:w-64"
        />
      </section>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load schedules"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={SearchX}
            title="No schedules match"
            description="Try another status or search."
            action={
              <Button variant="outline" onClick={() => update({ status: null, search: null })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={CalendarPlus}
            title="No maintenance schedules"
            description="Set up schedules to stay on top of your vehicle's servicing."
            action={
              <Button asChild>
                <Link to="/maintenance/schedules/new">Create schedule</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-12 gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
              <div className="col-span-4">Schedule</div>
              <div className="col-span-3">Interval &amp; baseline</div>
              <div className="col-span-3">Next due</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <ul className="divide-y">
              {items.map((schedule) => (
                <ScheduleRow
                  key={schedule.id}
                  schedule={schedule}
                  onOpen={() =>
                    navigate({
                      pathname: `/maintenance/schedules/${schedule.id}`,
                      search: params.toString(),
                    })
                  }
                />
              ))}
            </ul>
          </section>
          {list.data && list.data.meta.totalPages > 1 && (
            <Pager
              page={page}
              pageCount={list.data.meta.totalPages}
              onPageChange={(next) => update({ page: String(next) })}
            />
          )}
        </>
      )}
      <Outlet />
    </MaintenanceLayout>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | undefined;
  tone?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      className={cn("shrink-0 rounded-full", !active && tone)}
    >
      {label}
      {count !== undefined && (
        <span className="tabular-nums opacity-80">{formatNumber(count)}</span>
      )}
    </Button>
  );
}

function ScheduleRow({ schedule, onOpen }: { schedule: MaintenanceSchedule; onOpen: () => void }) {
  const group = maintenanceGroupOf(schedule.categoryKey);
  const Icon = GROUP_ICONS[group];
  const tone = SCHEDULE_STATUS_META[schedule.due.status].tone;
  const [first, second] = dueLines(schedule.due);
  const paused =
    schedule.due.status === ScheduleStatus.PAUSED ||
    schedule.due.status === ScheduleStatus.COMPLETED;
  return (
    <li
      className={cn(
        "relative grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-12 md:gap-4",
        paused && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 md:col-span-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted",
            TONE_TEXT[tone],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The whole row opens the details; the menu stays clickable above the link. */}
            <button
              type="button"
              onClick={onOpen}
              className="text-left font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {schedule.name}
            </button>
            {schedule.priority === "HIGH" && (
              <Badge
                variant="outline"
                className="border-transparent bg-destructive/15 text-destructive"
              >
                High
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{GROUP_NAMES[group]}</p>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ScheduleStatusBadge due={schedule.due} />
        </div>
      </div>
      <div className="min-w-0 md:col-span-3">
        <p className="text-sm tabular-nums">{intervalText(schedule)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{basisText(schedule)}</p>
      </div>
      <div className="min-w-0 md:col-span-3">
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            tone === "destructive" && TONE_TEXT.destructive,
          )}
        >
          {first}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {second
            ? `or ${second.charAt(0).toLowerCase()}${second.slice(1)}`
            : schedule.due.date
              ? "Time-based"
              : "Distance-based"}
        </p>
      </div>
      <div className="relative z-10 flex items-center justify-end gap-2 max-md:absolute max-md:top-3 max-md:right-3 md:col-span-2">
        <span className="max-md:hidden">
          <ScheduleStatusBadge due={schedule.due} />
        </span>
        <ScheduleActions schedule={schedule} />
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div
      className="flex flex-col gap-px overflow-hidden rounded-xl border"
      aria-busy="true"
      aria-label="Loading schedules"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-20 rounded-none" />
      ))}
    </div>
  );
}
