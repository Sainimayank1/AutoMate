import {
  maintenanceGroupOf,
  type MaintenanceOverview,
  type MaintenanceSchedule,
  ReportingPeriod,
} from "@automate/shared";
import { cn } from "cn";
import { CalendarPlus, Car } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import {
  AddScheduleButton,
  LogServiceButton,
} from "@/features/maintenance/components/add-schedule-button";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { DueSummary, ScheduleStatusBadge } from "@/features/maintenance/components/schedule-due";
import { SpendChart } from "@/features/maintenance/components/spend-chart";
import { GROUP_ICONS, GROUP_NAMES, STATE_META, TONE_TEXT } from "@/features/maintenance/constants";
import { useMaintenanceOverview } from "@/features/maintenance/hooks/use-maintenance";
import { dueShort, overdueBy } from "@/features/maintenance/utils/schedule-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

/** Presets of the spending card; a custom range comes with the History filters (phase 3). */
const PERIODS = [
  { value: ReportingPeriod.THIS_MONTH, label: "This month" },
  { value: ReportingPeriod.LAST_MONTH, label: "Last month" },
  { value: ReportingPeriod.LAST_3_MONTHS, label: "Last 3 months" },
  { value: ReportingPeriod.THIS_YEAR, label: "This year" },
  { value: ReportingPeriod.LAST_12_MONTHS, label: "Last 12 months" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const PREVIOUS_LABEL: Record<Period, string> = {
  this_month: "the same days last month",
  last_month: "the month before",
  last_3_months: "the 3 months before",
  this_year: "the same days last year",
  last_12_months: "the 12 months before",
};

/**
 * Stitch "Maintenance — Desktop / Mobile" (overview): status banner, four instruments, overdue and
 * coming-up schedules, then spending. Every figure comes from `/maintenance-overview`.
 * Deviations: the History…Analytics tabs arrive with their phases; the period
 * select has no Custom option yet; no health score (never claimed from maintenance data).
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const [period, setPeriod] = useState<Period>(ReportingPeriod.LAST_12_MONTHS);
  const overview = useMaintenanceOverview(vehicle?.id, { period });
  const data = overview.data;

  const description = vehicle
    ? `${vehicleName(vehicle)} · ${formatDistance(data?.odometerKm ?? vehicle.odometerKm)}`
    : null;

  if (garage.isError && !garage.data) {
    return (
      <MaintenanceLayout tab="overview">
        <ErrorState
          title="Couldn't load your garage"
          error={garage.error}
          onRetry={() => void garage.refetch()}
        />
      </MaintenanceLayout>
    );
  }
  if (!garage.isPending && !vehicle) {
    return (
      <MaintenanceLayout tab="overview" description="Service schedules and history.">
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

  return (
    <MaintenanceLayout
      tab="overview"
      description={description}
      actions={
        vehicle && (
          <>
            <AddScheduleButton variant="outline" />
            <LogServiceButton />
          </>
        )
      }
    >
      {overview.isError && !data ? (
        <ErrorState
          title="Couldn't load maintenance"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <StateBanner overview={data} />
          {/* Phones: due items first, then the instruments (Stitch mobile order). */}
          <div className="flex flex-col gap-6">
            <Stats overview={data} period={period} className="order-2 lg:order-1" />
            <DueCards overview={data} className="order-1 lg:order-2" />
          </div>
          <RecentCard overview={data} />
          <SpendCard overview={data} period={period} onPeriodChange={setPeriod} />
        </div>
      )}
    </MaintenanceLayout>
  );
}

function StateBanner({ overview }: { overview: MaintenanceOverview }) {
  const meta = STATE_META[overview.state];
  const { counts } = overview;
  const coming = counts.DUE + counts.DUE_SOON + counts.UPCOMING;
  const detail: Record<MaintenanceOverview["state"], string> = {
    OVERDUE: `${plural(counts.OVERDUE, "item")} overdue`,
    ATTENTION: `${plural(counts.DUE, "item")} due now`,
    UPCOMING: `${plural(coming, "item")} in the next 90 days`,
    ALL_CAUGHT_UP: "nothing due in the next 90 days",
    INCOMPLETE: "add schedules to track servicing",
  };
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <p
        className={cn(
          "flex min-w-0 items-center gap-2.5 text-sm font-medium",
          TONE_TEXT[meta.tone],
        )}
      >
        <meta.icon className="size-4 shrink-0" aria-hidden />
        <span>
          {meta.title} · {detail[overview.state]}
        </span>
      </p>
      {overview.state === "OVERDUE" && (
        <a
          href="#overdue"
          className={cn("shrink-0 text-xs font-medium hover:underline", TONE_TEXT.destructive)}
        >
          View overdue
        </a>
      )}
      {overview.state === "INCOMPLETE" && (
        <Link
          to="/maintenance/schedules/new"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Add schedule
        </Link>
      )}
    </div>
  );
}

const plural = (count: number, unit: string) =>
  `${formatNumber(count)} ${unit}${count === 1 ? "" : "s"}`;

function Stats({
  overview,
  period,
  className,
}: {
  overview: MaintenanceOverview;
  period: Period;
  className?: string;
}) {
  const { counts, spend, next, overdue } = overview;
  const worst = overdue[0];
  return (
    <section
      aria-label="Maintenance figures"
      className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}
    >
      <StatCard
        label="Maintenance spend"
        value={formatCurrency(spend.total)}
        hint={`${formatCurrency(spend.previousTotal)} ${PREVIOUS_LABEL[period]}`}
        href="/expenses/transactions"
      />
      <StatCard
        label="Overdue"
        value={
          <span className={cn(counts.OVERDUE > 0 && TONE_TEXT.destructive)}>
            {formatNumber(counts.OVERDUE)}
          </span>
        }
        hint={worst ? overdueBy(worst.due) : "Nothing overdue"}
      />
      <StatCard
        label="Due & upcoming"
        value={formatNumber(counts.DUE + counts.DUE_SOON + counts.UPCOMING)}
        hint="Within the next 90 days"
      />
      <StatCard
        label="Next service"
        value={<span className="block truncate text-lg">{next?.name ?? "—"}</span>}
        hint={
          <>
            {next ? dueShort(next.due) : "No active schedules"}
            {overview.recent[0] && (
              <span className="block">
                Last service {formatDate(overview.recent[0].serviceDate)}
              </span>
            )}
          </>
        }
      />
    </section>
  );
}

function ScheduleIcon({ schedule, tone }: { schedule: MaintenanceSchedule; tone?: string }) {
  const Icon = GROUP_ICONS[maintenanceGroupOf(schedule.categoryKey)];
  return (
    <div
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-md bg-muted", tone)}
    >
      <Icon className="size-4" aria-hidden />
    </div>
  );
}

const viewLink = (schedule: MaintenanceSchedule) => `/maintenance/schedules/${schedule.id}`;

function DueCards({ overview, className }: { overview: MaintenanceOverview; className?: string }) {
  const { overdue, upcoming } = overview;
  if (overview.state === "INCOMPLETE") {
    return (
      <EmptyState
        className={cn("rounded-xl border border-dashed", className)}
        icon={CalendarPlus}
        title="No maintenance schedules"
        description="Set up maintenance schedules to help you stay on top of your vehicle's servicing."
        action={<AddScheduleButton />}
      />
    );
  }
  return (
    <div className={cn("grid items-start gap-6 lg:grid-cols-12", className)}>
      {overdue.length > 0 && (
        <Card id="overdue" className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              Overdue
              <Badge
                variant="outline"
                className="border-transparent bg-destructive/15 text-destructive tabular-nums"
              >
                {overdue.length}
              </Badge>
            </CardTitle>
            <span className={cn("text-xs", TONE_TEXT.destructive)}>Action needed</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {overdue.map((schedule) => (
              <article
                key={schedule.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ScheduleIcon schedule={schedule} tone="bg-destructive/15 text-destructive" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{schedule.name}</h3>
                      {schedule.priority === "HIGH" && (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-destructive/15 text-destructive"
                        >
                          High
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {GROUP_NAMES[maintenanceGroupOf(schedule.categoryKey)]} ·{" "}
                      <span className={cn("font-medium tabular-nums", TONE_TEXT.destructive)}>
                        {overdueBy(schedule.due)}
                      </span>
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={viewLink(schedule)}>View</Link>
                </Button>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
      <Card className={cn(overdue.length > 0 ? "lg:col-span-7" : "lg:col-span-12")}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Coming up</CardTitle>
          <Link
            to="/maintenance/schedules"
            className="text-sm font-medium text-primary hover:underline"
          >
            All schedules
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next 90 days.</p>
          ) : (
            upcoming.map((schedule) => (
              <Link
                key={schedule.id}
                to={viewLink(schedule)}
                className="flex flex-col gap-2.5 rounded-lg border bg-muted/40 p-4 transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <h3 className="font-medium">{schedule.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      {GROUP_NAMES[maintenanceGroupOf(schedule.categoryKey)]}
                    </span>
                  </div>
                  <ScheduleStatusBadge due={schedule.due} />
                </div>
                <DueSummary schedule={schedule} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Stitch "Maintenance": the latest service records, each linking to its details. */
function RecentCard({ overview }: { overview: MaintenanceOverview }) {
  const { recent, recordCount } = overview;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Recent maintenance</CardTitle>
        {recordCount > 0 ? (
          <Link
            to="/maintenance/history"
            className="text-sm font-medium text-primary hover:underline"
          >
            All {formatNumber(recordCount)} {recordCount === 1 ? "record" : "records"}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums">No records yet</span>
        )}
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Your services and repairs will appear here when you log them.
            </p>
            <LogServiceButton variant="outline" label="Log a service" />
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((record) => (
              <li key={record.id}>
                <Link
                  to={`/maintenance/records/${record.vehicleId}/${record.id}`}
                  className="flex items-center justify-between gap-3 rounded-md py-3 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{record.title}</p>
                    <p className="truncate text-sm text-muted-foreground tabular-nums">
                      {[
                        formatDate(record.serviceDate),
                        record.odometerKm !== null && formatDistance(record.odometerKm),
                        record.provider?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(record.totalAmount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SpendCard({
  overview,
  period,
  onPeriodChange,
}: {
  overview: MaintenanceOverview;
  period: Period;
  onPeriodChange: (period: Period) => void;
}) {
  const { spend } = overview;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Maintenance spending</CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-sm bg-chart-1" aria-hidden />
              Maintenance{" "}
              <strong className="font-medium text-foreground">
                {formatCurrency(spend.maintenance)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-sm bg-chart-2" aria-hidden />
              Repairs{" "}
              <strong className="font-medium text-foreground">
                {formatCurrency(spend.repairs)}
              </strong>
            </span>
          </div>
        </div>
        <Select value={period} onValueChange={(next) => onPeriodChange(next as Period)}>
          <SelectTrigger aria-label="Spending period" size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SpendChart months={spend.months} />
        <p className="text-xs text-muted-foreground">
          From your expenses in Maintenance &amp; servicing and Repairs.
        </p>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading maintenance">
      <Skeleton className="h-12 rounded-lg" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCard key={index} label="" value="" loading />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-48 rounded-xl lg:col-span-5" />
        <Skeleton className="h-48 rounded-xl lg:col-span-7" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
