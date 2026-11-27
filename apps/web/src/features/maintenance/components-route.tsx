import { type MaintenanceGroupKey, type VehicleComponent } from "@automate/shared";
import { cn } from "cn";
import { Car, Cog, Plus, SearchX } from "lucide-react";
import { useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router";

import { Pager } from "@/components/common/pager";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { vehicleName } from "@/features/garage/constants";
import { MaintenanceLayout } from "@/features/maintenance/components/maintenance-layout";
import {
  COMPONENT_STATUS_META,
  GROUP_ICONS,
  TONE_PROGRESS,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import { useComponents } from "@/features/maintenance/hooks/use-maintenance";
import {
  kindGroup,
  lifeText,
  partCaption,
  warrantyText,
} from "@/features/maintenance/utils/component-text";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

type View = "installed" | "history";

function AddComponentButton() {
  return (
    <Button asChild>
      <Link to="/maintenance/components/new">
        <Plus data-icon="inline-start" />
        Add component
      </Link>
    </Button>
  );
}

/**
 * Stitch "Maintenance Components — Desktop / Mobile": the lifecycle tracker. Fitted parts (most in
 * need of a look first) or the ones replaced and removed, as cards with status, install, estimated
 * life and warranty. Every figure comes from the API; lifespans are always called estimates.
 */
export function Component() {
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "history" ? "history" : "installed";
  const search = params.get("search") ?? "";
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const list = useComponents(vehicle?.id, {
    state: view,
    page,
    ...(deferredSearch && { search: deferredSearch }),
  });
  // Just the count for the other chip.
  const other = useComponents(vehicle?.id, {
    state: view === "installed" ? "history" : "installed",
    pageSize: 1,
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
      <MaintenanceLayout tab="components">
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

  const count = (state: View) => (state === view ? list.data : other.data)?.meta.total;
  const items = list.data?.items;
  return (
    <MaintenanceLayout
      tab="components"
      description={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      actions={vehicle && <AddComponentButton />}
    >
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Component lifecycle filter">
          {(
            [
              ["installed", "Installed"],
              ["history", "Replaced & removed"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={view === value ? "default" : "outline"}
              aria-pressed={view === value}
              className="rounded-full"
              onClick={() => update({ view: value === "history" ? value : null })}
            >
              {label}
              {count(value) !== undefined && (
                <span className="tabular-nums opacity-80">{formatNumber(count(value)!)}</span>
              )}
            </Button>
          ))}
        </div>
        <SearchInput
          value={search}
          onValueChange={(value) => update({ search: value || null })}
          placeholder="Search components"
          aria-label="Search components"
          className="w-full sm:w-64"
        />
      </section>

      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load components"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !items ? (
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading components"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        search ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={SearchX}
            title="No components match"
            description="Try another search."
            action={
              <Button variant="outline" onClick={() => update({ search: null })}>
                Clear search
              </Button>
            }
          />
        ) : view === "history" ? (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Cog}
            title="Nothing replaced or removed yet"
            description="Parts you replace or remove stay here with their whole history."
          />
        ) : (
          <EmptyState
            className="rounded-xl border border-dashed"
            icon={Cog}
            title="No components tracked"
            description="Start tracking important parts of your vehicle to monitor their lifecycle."
            action={<AddComponentButton />}
          />
        )
      ) : (
        <>
          <ul className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((part) => (
              <li key={part.id}>
                <ComponentCard part={part} />
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

function ComponentCard({ part }: { part: VehicleComponent }) {
  const meta = COMPONENT_STATUS_META[part.status];
  const Icon = GROUP_ICONS[kindGroup(part.kind) as MaintenanceGroupKey];
  const fitted = part.state === "INSTALLED";
  const life = lifeText(part);
  const warranty = warrantyText(part);
  return (
    <Link
      to={`/maintenance/components/${part.id}`}
      className="flex h-full flex-col justify-between gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted",
              TONE_TEXT[meta.tone],
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
          <StatusBadge tone={meta.tone} icon={meta.icon} label={meta.label} />
        </div>
        <div className="min-w-0">
          <h2 className="font-medium">{part.name}</h2>
          {partCaption(part) && (
            <p className="text-sm text-muted-foreground">{partCaption(part)}</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {fitted
            ? part.installedAt || part.installedKm !== null
              ? `Installed ${[part.installedAt && formatDate(part.installedAt), part.installedKm !== null && formatDistance(part.installedKm)].filter(Boolean).join(" · ")}`
              : "Install date not recorded"
            : `${part.state === "REPLACED" ? "Replaced" : "Removed"} ${[part.removedAt && formatDate(part.removedAt), part.removedKm !== null && formatDistance(part.removedKm)].filter(Boolean).join(" · ")}`}
        </p>
        {fitted ? (
          life ? (
            <div className="flex flex-col gap-1.5">
              <Progress
                value={Math.min(100, Math.round(part.life!.fractionUsed * 100))}
                aria-label="Estimated life used"
                className={cn("h-1.5", TONE_PROGRESS[meta.tone])}
              />
              <p className="text-sm text-muted-foreground tabular-nums">Estimated life: {life}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No lifespan set</p>
          )
        ) : (
          part.replacedBy && (
            <p className="text-sm text-muted-foreground">Replaced by {part.replacedBy.name}</p>
          )
        )}
      </div>
      {warranty && (
        <p
          className={cn(
            "border-t pt-3 text-sm tabular-nums",
            part.warrantyActive ? "text-success" : "text-muted-foreground",
          )}
        >
          {warranty}
        </p>
      )}
    </Link>
  );
}
