import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Fuel, Gauge, Plus } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { VehicleImage } from "@/components/common/vehicle-image";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DashboardControls,
  DashboardGreeting,
} from "@/features/dashboard/components/dashboard-header";
import { DrivingCard } from "@/features/dashboard/components/driving-card";
import { ExpiryCard } from "@/features/dashboard/components/expiry-card";
import { FuelSection } from "@/features/dashboard/components/fuel-section";
import {
  MaintenanceCard,
  MaintenanceSetup,
} from "@/features/dashboard/components/maintenance-card";
import { MetricStrip } from "@/features/dashboard/components/metric-strip";
import { SectionState } from "@/features/dashboard/components/section-state";
import { SpendingSection } from "@/features/dashboard/components/spending-section";
import { StatusPanel } from "@/features/dashboard/components/status-panel";
import { VehicleHero } from "@/features/dashboard/components/vehicle-hero";
import { dashboardKeys, useDashboardOverview } from "@/features/dashboard/hooks/use-dashboard";
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
        <DashboardGreeting />
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
      <DashboardGreeting>
        <DashboardControls
          vehicles={garage.vehicles}
          vehicleId={garage.activeVehicle.id}
          onVehicleChange={garage.setActiveVehicleId}
          period={period}
          shown={overview.data?.period}
          refreshing={overview.isFetching}
          onRefresh={() => void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })}
        />
      </DashboardGreeting>
      {overview.isError && !overview.data ? (
        <ErrorState
          title="Couldn't load the dashboard"
          error={overview.error}
          onRetry={() => void overview.refetch()}
        />
      ) : !overview.data ? (
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
            <div className="lg:col-span-8">
              <VehicleHero vehicle={overview.data.vehicle} />
            </div>
            <div className="lg:col-span-4">
              <SectionState section={overview.data.status} onRetry={retry} className="h-full">
                {(status) => <StatusPanel status={status} />}
              </SectionState>
            </div>
          </div>
          <SectionState section={overview.data.metrics} onRetry={retry} empty={<NoFigures />}>
            {(metrics) => <MetricStrip metrics={metrics} period={overview.data.period} />}
          </SectionState>
          <SectionState section={overview.data.spending} onRetry={retry}>
            {(spending) => (
              <SpendingSection
                spending={spending}
                period={overview.data.period}
                vehicleId={overview.data.vehicle.id}
              />
            )}
          </SectionState>
          <SectionState
            section={overview.data.fuel}
            onRetry={retry}
            // With no records at all, "No figures yet" above already says it.
            empty={overview.data.metrics.state === "empty" ? null : <NoFillUps />}
          >
            {(fuel) => <FuelSection fuel={fuel} range={formatDateRange(overview.data.period)} />}
          </SectionState>
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionState
              section={overview.data.maintenance}
              onRetry={retry}
              empty={<MaintenanceSetup />}
            >
              {(maintenance) => (
                <MaintenanceCard maintenance={maintenance} vehicleId={overview.data.vehicle.id} />
              )}
            </SectionState>
            <SectionState section={overview.data.expiries} onRetry={retry}>
              {(items) => <ExpiryCard items={items} />}
            </SectionState>
            <SectionState section={overview.data.driving} onRetry={retry}>
              {(driving) => (
                <DrivingCard driving={driving} range={formatDateRange(overview.data.period)} />
              )}
            </SectionState>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

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
      <DashboardGreeting />
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-dashed bg-card p-6 text-center sm:p-10">
        <VehicleImage
          make=""
          model=""
          showLabel={false}
          className="h-32 w-56 max-w-full rounded-xl border"
        />
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Add your first vehicle
          </h2>
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

/** Hero and status side by side, then the metric strip (Stitch layout). */
function SectionsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-64 rounded-xl lg:col-span-8" />
        <Skeleton className="h-64 rounded-xl lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
