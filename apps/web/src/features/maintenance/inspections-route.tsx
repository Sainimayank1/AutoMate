import { type Inspection, type InspectionKind } from "@automate/shared";
import { cn } from "cn";
import { CalendarClock, Car, ChevronRight, ClipboardCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import { INSPECTION_KIND_LABELS, TONE_SOFT } from "@/features/maintenance/constants";
import { useInspections } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

const FILTERS: [InspectionKind | null, string][] = [
  [null, "All"],
  ["SELF_CHECK", "Your checks"],
  ["PROFESSIONAL", "Professional"],
];

function StartButton() {
  return (
    <Button asChild>
      <Link to="/maintenance/inspections/new">
        <ClipboardCheck data-icon="inline-start" />
        Start inspection
      </Link>
    </Button>
  );
}

/**
 * Stitch "Maintenance Inspections — Desktop / Mobile": the user's own checks and workshop
 * inspections, newest first, with what each found and its follow-up date.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const [params, setParams] = useSearchParams();
  const raw = params.get("kind");
  const kind = raw === "SELF_CHECK" || raw === "PROFESSIONAL" ? raw : null;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const list = useInspections(vehicle?.id, { page, ...(kind && { kind }) });
  // Just the counts for the chips (All is their sum).
  const own = useInspections(vehicle?.id, { kind: "SELF_CHECK", pageSize: 1 });
  const pro = useInspections(vehicle?.id, { kind: "PROFESSIONAL", pageSize: 1 });

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
      <MaintenanceLayout tab="inspections">
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

  const ownCount = own.data?.meta.total;
  const proCount = pro.data?.meta.total;
  const count = (value: InspectionKind | null) =>
    value === "SELF_CHECK"
      ? ownCount
      : value === "PROFESSIONAL"
        ? proCount
        : ownCount !== undefined && proCount !== undefined
          ? ownCount + proCount
          : undefined;
  const items = list.data?.items;
  return (
    <MaintenanceLayout
      tab="inspections"
      description={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      actions={vehicle && <StartButton />}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter inspections by kind">
        {FILTERS.map(([value, label]) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={kind === value ? "default" : "outline"}
            aria-pressed={kind === value}
            className="rounded-full"
            onClick={() => update({ kind: value })}
          >
            {label}
            {count(value) !== undefined && (
              <span className="tabular-nums opacity-80">{formatNumber(count(value)!)}</span>
            )}
          </Button>
        ))}
      </div>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load inspections"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading inspections">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        kind ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={ClipboardCheck}
            title={kind === "SELF_CHECK" ? "No checks of your own yet" : "No workshop inspections"}
            description="Inspections of the other kind are under All."
            action={
              <Button variant="outline" onClick={() => update({ kind: null })}>
                Show all
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={ClipboardCheck}
            title="No inspections yet"
            description="Record your own checks or a workshop's inspection to track condition over time."
            action={<StartButton />}
          />
        )
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((inspection) => (
              <li key={inspection.id}>
                <InspectionRow inspection={inspection} />
              </li>
            ))}
          </ul>
          {list.data!.meta.totalPages > 1 && (
            <Pager
              page={page}
              pageCount={list.data!.meta.totalPages}
              onPageChange={(next) => update({ page: String(next) })}
            />
          )}
        </>
      )}
    </MaintenanceLayout>
  );
}

function InspectionRow({ inspection }: { inspection: Inspection }) {
  const { counts } = inspection;
  const tone = counts.issues ? "warning" : counts.monitor ? "info" : "success";
  return (
    <Link
      to={`/maintenance/inspections/${inspection.id}`}
      className="grid items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none md:grid-cols-12 md:gap-4"
    >
      <div className="flex min-w-0 items-center gap-3.5 md:col-span-5">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border",
            TONE_SOFT[tone],
          )}
        >
          <ClipboardCheck className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{inspection.title}</h2>
            <Badge variant={inspection.kind === "PROFESSIONAL" ? "outline" : "secondary"}>
              {INSPECTION_KIND_LABELS[inspection.kind]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {[
              formatDate(inspection.date),
              inspection.odometerKm !== null && formatDistance(inspection.odometerKm),
              inspection.provider?.name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <p className="text-sm font-medium tabular-nums md:col-span-4">
        <span className={counts.issues ? "text-warning" : "text-muted-foreground"}>
          {counts.issues} {counts.issues === 1 ? "issue" : "issues"}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className={counts.monitor ? "text-info" : "text-muted-foreground"}>
          {counts.monitor} to monitor
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-success">{counts.ok} good</span>
      </p>
      <div className="flex items-center justify-between gap-3 md:col-span-3 md:justify-end">
        {inspection.followUpDate ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
            <CalendarClock className="size-4 text-warning" aria-hidden />
            Follow up by {formatDate(inspection.followUpDate)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No follow-up set</span>
        )}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}
