import {
  bulkCreateSchedulesSchema,
  MAINTENANCE_TEMPLATES,
  maintenanceGroupOf,
  type MaintenanceSchedule,
  TEMPLATE_CAUTION,
  type Vehicle,
} from "@automate/shared";
import { CalendarClock, Car, Info, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { NumberInput } from "@/components/common/number-input";
import { Pager } from "@/components/common/pager";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { vehicleName } from "@/features/garage/constants";
import { LogServiceButton } from "@/features/maintenance/components/add-schedule-button";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { ScheduleStatusBadge } from "@/features/maintenance/components/schedule-due";
import { GROUP_ICONS } from "@/features/maintenance/constants";
import {
  useCreateSchedules,
  usePlanSummary,
  useSchedules,
} from "@/features/maintenance/hooks/use-maintenance";
import { dueShort } from "@/features/maintenance/utils/schedule-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { normalizeApiError } from "@/lib/api-error";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

type Template = (typeof MAINTENANCE_TEMPLATES)[number];

const every = (item: Template["items"][number]) =>
  [
    item.intervalKm && formatDistance(item.intervalKm),
    item.intervalMonths && `${item.intervalMonths} months`,
  ]
    .filter(Boolean)
    .join(" or ");

/**
 * Stitch "Maintenance Planner — Desktop / Mobile": one-time jobs to budget for, with the total of
 * their estimates from `/maintenance-plan` (never counted as spend), and generic schedule
 * templates reviewed before anything is added. Deviations: the total covers every open planned
 * job, not "the next 12 months" (a job due by km has no date); a job opens its schedule sheet
 * instead of a menu.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const [page, setPage] = useState(1);
  const [template, setTemplate] = useState<Template | null>(null);
  const plan = usePlanSummary(vehicle?.id);
  const jobs = useSchedules(vehicle?.id, { once: true, page, pageSize: 20 });

  if (!garage.isPending && !vehicle) {
    return (
      <MaintenanceLayout tab="planner" description="Service schedules and history.">
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

  const items = jobs.data?.items ?? [];
  return (
    <MaintenanceLayout
      tab="planner"
      description={vehicle && vehicleName(vehicle)}
      actions={vehicle && <LogServiceButton />}
    >
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={2}>
              Planned maintenance
            </CardTitle>
            <CardDescription>One-off jobs you want to budget for ahead of time</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="sm:text-right">
              <p className="text-xs text-muted-foreground">
                Estimated total · not counted as spend
              </p>
              {plan.data ? (
                <p className="font-heading text-xl font-semibold tabular-nums">
                  {formatCurrency(plan.data.estimatedTotal)}
                </p>
              ) : (
                <Skeleton className="h-7 w-28 sm:ml-auto" />
              )}
              {!!plan.data?.withoutEstimate && (
                <p className="text-xs text-muted-foreground">
                  {formatNumber(plan.data.withoutEstimate)} without an estimate
                </p>
              )}
            </div>
            <Button asChild>
              <Link to="/maintenance/schedules/new?once=1">
                <Plus data-icon="inline-start" />
                Add planned job
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {jobs.isError && !jobs.data ? (
            <ErrorState
              title="Couldn't load planned jobs"
              error={jobs.error}
              onRetry={() => void jobs.refetch()}
            />
          ) : !jobs.data ? (
            [0, 1].map((index) => <Skeleton key={index} className="h-16 rounded-lg" />)
          ) : !items.length ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing planned yet"
              description="Add a one-off job, like new tyres or a battery, with what you expect it to cost."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((job) => (
                <PlannedJob key={job.id} job={job} />
              ))}
            </ul>
          )}
          <Pager page={page} pageCount={jobs.data?.meta.totalPages ?? 0} onPageChange={setPage} />
        </CardContent>
      </Card>

      <section aria-labelledby="templates-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="templates-title" className="font-heading text-lg font-semibold">
            Schedule templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Add repeating schedules by vehicle type, then tailor the intervals before saving
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-warning">
            <Info className="size-4 shrink-0" aria-hidden />
            {TEMPLATE_CAUTION}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MAINTENANCE_TEMPLATES.map((item) => (
            <Card key={item.key} className="flex flex-col">
              <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                  {item.name}
                </CardTitle>
                <CardDescription>{item.items.length} schedules</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
                  {item.items.slice(0, 4).map((line) => (
                    <li key={line.name}>
                      {line.name} every {every(line)}
                    </li>
                  ))}
                  {item.items.length > 4 && <li>and {item.items.length - 4} more</li>}
                </ul>
                <Button
                  variant="outline"
                  disabled={!vehicle || !!vehicle.archivedAt}
                  onClick={() => setTemplate(item)}
                >
                  Apply template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {vehicle && template && (
        <ReviewTemplate
          key={template.key}
          vehicle={vehicle}
          template={template}
          onClose={() => setTemplate(null)}
        />
      )}
    </MaintenanceLayout>
  );
}

function PlannedJob({ job }: { job: MaintenanceSchedule }) {
  const Icon = GROUP_ICONS[maintenanceGroupOf(job.categoryKey)];
  const by = [
    job.dueKm && `by ${formatDistance(job.dueKm)}`,
    job.dueDate && `by ${formatDate(job.dueDate)}`,
  ]
    .filter(Boolean)
    .join(" or ");
  return (
    <li>
      <Link
        to={`/maintenance/schedules/${job.id}`}
        className="flex items-center gap-3.5 rounded-lg border bg-muted/30 p-3.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{job.name}</span>
          <span className="text-xs text-muted-foreground">
            {[by, dueShort(job.due)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm tabular-nums">
            {job.estimatedCost ? `est. ${formatCurrency(job.estimatedCost)}` : "No estimate"}
          </span>
          <ScheduleStatusBadge due={job.due} />
        </span>
      </Link>
    </li>
  );
}

type Row = { checked: boolean; intervalKm: string; intervalMonths: string };

/** Stitch's review step: tick and edit each interval before the schedules are added at once. */
function ReviewTemplate({
  vehicle,
  template,
  onClose,
}: {
  vehicle: Vehicle;
  template: Template;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateSchedules(vehicle.id);
  const [rows, setRows] = useState<Row[]>(() =>
    template.items.map((item) => ({
      checked: true,
      intervalKm: item.intervalKm ? String(item.intervalKm) : "",
      intervalMonths: item.intervalMonths ? String(item.intervalMonths) : "",
    })),
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const selected = rows.flatMap((row, index) => (row.checked ? [index] : []));
  const set = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  const submit = async () => {
    setFailure(null);
    const parsed = bulkCreateSchedulesSchema.safeParse({
      schedules: selected.map((index) => ({
        name: template.items[index]!.name,
        categoryKey: template.items[index]!.categoryKey,
        intervalKm: rows[index]!.intervalKm,
        intervalMonths: rows[index]!.intervalMonths,
      })),
    });
    if (!parsed.success) {
      const found: Record<number, string> = {};
      for (const issue of parsed.error.issues) {
        const at = issue.path[1];
        if (typeof at === "number") found[selected[at]!] ??= issue.message;
        else setFailure(issue.message);
      }
      setErrors(found);
      return;
    }
    setErrors({});
    try {
      await create.mutateAsync(parsed.data);
      onClose();
      void navigate("/maintenance/schedules");
    } catch (error) {
      setFailure(normalizeApiError(error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review template: {template.name}</DialogTitle>
          <DialogDescription>
            Applying to {vehicleName(vehicle)} ({vehicle.registrationNumber}) · Edit or untick
            intervals before adding
          </DialogDescription>
        </DialogHeader>
        <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <Info className="size-4 shrink-0" aria-hidden />
          {TEMPLATE_CAUTION}
        </p>
        <ul className="flex flex-col divide-y">
          {template.items.map((item, index) => {
            const row = rows[index]!;
            const id = `template-${template.key}-${index}`;
            return (
              <li key={item.name} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id={id}
                    checked={row.checked}
                    onCheckedChange={(checked) => set(index, { checked: checked === true })}
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium">
                    {item.name}
                  </label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-28">
                      <NumberInput
                        value={row.intervalKm}
                        onChange={(intervalKm) => set(index, { intervalKm })}
                        suffix="km"
                        disabled={!row.checked}
                        aria-invalid={!!errors[index]}
                        placeholder="—"
                      />
                    </div>
                    or
                    <div className="w-24">
                      <NumberInput
                        value={row.intervalMonths}
                        onChange={(intervalMonths) => set(index, { intervalMonths })}
                        suffix="mo"
                        disabled={!row.checked}
                        aria-invalid={!!errors[index]}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>
                {errors[index] && (
                  <p role="alert" className="text-xs text-destructive">
                    {errors[index]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            {selected.length} of {template.items.length} schedules selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={!selected.length || create.isPending}>
              {create.isPending && <Spinner data-icon="inline-start" />}
              Add {selected.length} schedule{selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
