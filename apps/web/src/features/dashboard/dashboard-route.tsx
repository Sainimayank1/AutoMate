import { type DashboardLayout, type DashboardOverview, DashboardWidget } from "@automate/shared";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Fuel, Gauge, Plus } from "lucide-react";
import { Fragment, type ReactNode, useEffect } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { VehicleImage } from "@/components/common/vehicle-image";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomiseDashboard } from "@/features/dashboard/components/customise-dashboard";
import {
  DashboardControls,
  DashboardTitle,
} from "@/features/dashboard/components/dashboard-header";
import { DrivingCard } from "@/features/dashboard/components/driving-card";
import { ExpiryCard } from "@/features/dashboard/components/expiry-card";
import { FuelSection } from "@/features/dashboard/components/fuel-section";
import {
  MaintenanceCard,
  MaintenanceSetup,
} from "@/features/dashboard/components/maintenance-card";
import { MetricStrip } from "@/features/dashboard/components/metric-strip";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { SectionState } from "@/features/dashboard/components/section-state";
import { SmartInsights } from "@/features/dashboard/components/smart-insights";
import { SpendingSection } from "@/features/dashboard/components/spending-section";
import { StatusPanel } from "@/features/dashboard/components/status-panel";
import { VehicleHero } from "@/features/dashboard/components/vehicle-hero";
import { SMALL_WIDGETS } from "@/features/dashboard/constants";
import { dashboardKeys, useDashboardOverview } from "@/features/dashboard/hooks/use-dashboard";
import { useDashboardLayout } from "@/features/dashboard/hooks/use-dashboard-layout";
import { useDashboardPeriod } from "@/features/dashboard/hooks/use-dashboard-period";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDateRange } from "@/utils/format";

/**
 * `/dashboard` (Stitch "Dashboard — Desktop / Mobile"): the active vehicle over a period. Figures
 * come from `GET /dashboard/overview`; sections arrive phase by phase (docs/architecture/dashboard.md).
 */
export function Component() {
  const queryClient = useQueryClient();
  const garage = useActiveVehicle();
  const period = useDashboardPeriod();
  const { layout, ready: layoutReady, loaded: layoutLoaded } = useDashboardLayout();
  const vehicleId = garage.activeVehicle?.id;
  const overview = useDashboardOverview(
    { vehicleId, period: period.period, from: period.from, to: period.to },
    { enabled: !!vehicleId },
  );
  // The vehicle went away (deleted or archived on another device): refresh the garage, and the
  // active vehicle falls back to the next one.
  const missing = overview.error?.status === 404;
  useEffect(() => {
    if (missing) void queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
  }, [missing, queryClient]);

  const retry = () => void overview.refetch();

  if (garage.isPending) return <DashboardSkeleton />;
  if (garage.isError && !garage.data) {
    return (
      <PageContainer>
        <DashboardTitle />
        <ErrorState
          title="Couldn't load your garage"
          error={garage.error}
          onRetry={() => void garage.refetch()}
        />
      </PageContainer>
    );
  }
  if (!garage.activeVehicle) return <DashboardEmptyState />;

  return (
    <PageContainer>
      <DashboardTitle>
        <DashboardControls
          vehicles={garage.vehicles}
          vehicleId={garage.activeVehicle.id}
          onVehicleChange={garage.setActiveVehicleId}
          period={period}
          shown={overview.data?.period}
          refreshing={overview.isFetching}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })}
        >
          <CustomiseDashboard layout={layout} disabled={!layoutLoaded} />
        </DashboardControls>
      </DashboardTitle>
      {overview.isError && !overview.data ? (
        <ErrorState
          title="Couldn't load the dashboard"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : !overview.data || !layoutReady ? (
        <SectionsSkeleton />
      ) : (
        <div
          aria-busy={overview.isPlaceholderData}
          className={cn(
            "flex flex-col gap-6 transition-opacity",
            // The last period's figures stay until the new ones arrive: dimmed.
            overview.isPlaceholderData && "opacity-60",
          )}
        >
          <div className="grid gap-6 lg:grid-cols-12">
            {/* min-w-0: truncated text mustn't widen the column past a 360px phone. */}
            <div className="min-w-0 lg:col-span-8">
              <VehicleHero vehicle={overview.data.vehicle} />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <SectionState section={overview.data.status} onRetry={retry} className="h-full">
                {(status) => <StatusPanel status={status} vehicleId={overview.data.vehicle.id} />}
              </SectionState>
            </div>
          </div>
          <Sections overview={overview.data} layout={layout} onRetry={retry} />
        </div>
      )}
    </PageContainer>
  );
}

/**
 * The sections below the hero, in the user's order (Customise); hidden ones aren't rendered.
 * Consecutive small cards share a row.
 */
function Sections({
  overview,
  layout,
  onRetry,
}: {
  overview: DashboardOverview;
  layout: DashboardLayout;
  onRetry: () => void;
}) {
  const shown = layout.widgets.filter((widget) => widget.visible).map((widget) => widget.id);
  // With no records at all, "No figures yet" in the key figures says what to add; while that
  // shows, the insights and fuel sections don't repeat it.
  const noFigures = overview.metrics.state === "empty" && shown.includes(DashboardWidget.METRICS);
  const range = formatDateRange(overview.period);
  const vehicleId = overview.vehicle.id;
  const render: Record<DashboardWidget, ReactNode> = {
    metrics: (
      <SectionState section={overview.metrics} onRetry={onRetry} empty={<NoFigures />}>
        {(metrics) => (
          <MetricStrip metrics={metrics} period={overview.period} shown={layout.metrics} />
        )}
      </SectionState>
    ),
    insights: noFigures ? null : (
      <SectionState section={overview.insights} onRetry={onRetry}>
        {(insights) => (
          <SmartInsights insights={insights} comparedWith={overview.period.previous} />
        )}
      </SectionState>
    ),
    spending: (
      <SectionState section={overview.spending} onRetry={onRetry}>
        {(spending) => (
          <SpendingSection spending={spending} period={overview.period} vehicleId={vehicleId} />
        )}
      </SectionState>
    ),
    fuel: (
      <SectionState
        section={overview.fuel}
        onRetry={onRetry}
        empty={noFigures ? null : <NoFillUps />}
      >
        {(fuel) => <FuelSection fuel={fuel} range={range} />}
      </SectionState>
    ),
    maintenance: (
      <SectionState section={overview.maintenance} onRetry={onRetry} empty={<MaintenanceSetup />}>
        {(maintenance) => <MaintenanceCard maintenance={maintenance} vehicleId={vehicleId} />}
      </SectionState>
    ),
    expiries: (
      <SectionState section={overview.expiries} onRetry={onRetry}>
        {(items) => <ExpiryCard items={items} />}
      </SectionState>
    ),
    driving: (
      <SectionState section={overview.driving} onRetry={onRetry}>
        {(driving) => <DrivingCard driving={driving} range={range} vehicleId={vehicleId} />}
      </SectionState>
    ),
    activity: <RecentActivity key={vehicleId} vehicleId={vehicleId} />,
  };

  if (!shown.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Every section is hidden. Use Customise to show them again.
      </p>
    );
  }
  const rows: DashboardWidget[][] = [];
  for (const widget of shown) {
    const row = rows.at(-1);
    if (row && SMALL_WIDGETS.has(widget) && SMALL_WIDGETS.has(row[0]!)) row.push(widget);
    else rows.push([widget]);
  }
  return rows.map((row) =>
    SMALL_WIDGETS.has(row[0]!) ? (
      <div key={row.join()} className={cn("grid gap-6", ROW_COLUMNS[row.length])}>
        {row.map((widget) => (
          <Fragment key={widget}>{render[widget]}</Fragment>
        ))}
      </div>
    ) : (
      <Fragment key={row[0]}>{render[row[0]!]}</Fragment>
    ),
  );
}

const ROW_COLUMNS = ["", "", "lg:grid-cols-2", "lg:grid-cols-3"];

/** The vehicle has no fill-up or expense yet: nothing to add up. */
function NoFigures() {
  return (
    <EmptyState
      className="rounded-xl border border-dashed"
      icon={Gauge}
      title="No figures yet"
      description="Log a fill-up or an expense for this vehicle to see what it costs to run."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/fuel/new">Add fuel</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/expenses/new">Add expense</Link>
          </Button>
        </div>
      }
    />
  );
}

/** Expenses but no fill-up yet: mileage needs fill-ups. */
function NoFillUps() {
  return (
    <EmptyState
      className="rounded-xl border border-dashed"
      icon={Fuel}
      title="No fill-ups yet"
      description="Log fill-ups (fill to full when you can) to see mileage and what fuel costs per km."
      action={
        <Button asChild>
          <Link to="/fuel/new">Add fuel</Link>
        </Button>
      }
    />
  );
}

/** Stitch "Dashboard — Empty State": no vehicle yet. */
function DashboardEmptyState() {
  return (
    <PageContainer>
      <DashboardTitle />
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-dashed bg-card p-6 text-center sm:p-10">
        <VehicleImage
          make=""
          model=""
          showLabel={false}
          className="h-32 w-56 max-w-full rounded-xl border"
        />
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="font-heading text-xl font-medium">Add your first vehicle</h2>
          <p className="text-sm text-muted-foreground">
            Your dashboard fills in as you log fill-ups and expenses for it.
          </p>
        </div>
        <Button asChild>
          <Link to="/garage/new">
            <Plus data-icon="inline-start" />
            Add vehicle
          </Link>
        </Button>
      </div>
    </PageContainer>
  );
}

/** The page while the garage loads: shaped like the dashboard, so nothing jumps. */
function DashboardSkeleton() {
  return (
    <PageContainer aria-busy>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-full sm:w-96" />
      </div>
      <SectionsSkeleton />
    </PageContainer>
  );
}

/** Hero and status side by side, then the metric strip, at about their real heights. */
function SectionsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">Loading the dashboard…</span>
      <div aria-hidden className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[30rem] rounded-xl lg:col-span-8 lg:h-[34rem]" />
        <Skeleton className="h-96 rounded-xl lg:col-span-4 lg:h-[34rem]" />
      </div>
      <div aria-hidden className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
