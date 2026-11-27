import type { Vehicle } from "@automate/shared";
import { cn } from "cn";
import { Car, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { VehicleImage } from "@/components/common/vehicle-image";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { VehicleCard, VehicleCardSkeleton } from "@/features/garage/components/vehicle-card";
import { FUEL_TYPE_LABELS, OWNERSHIP_LABELS } from "@/features/garage/constants";
import { useRestoreVehicle, useVehicles } from "@/features/garage/hooks/use-vehicles";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { formatDistance, formatNumber } from "@/utils/format";

type Filter = { id: string; label: string; match: (vehicle: Vehicle) => boolean };

/** Chips from the data: ownership and fuel types that actually occur (Stitch "Garage"). */
function filtersFor(vehicles: Vehicle[]): Filter[] {
  const ownerships = [...new Set(vehicles.map((vehicle) => vehicle.ownershipType))];
  const fuels = [...new Set(vehicles.map((vehicle) => vehicle.fuelType))];
  return [
    { id: "all", label: "All", match: () => true },
    ...ownerships.map((ownership) => ({
      id: `ownership:${ownership}`,
      label: OWNERSHIP_LABELS[ownership],
      match: (vehicle: Vehicle) => vehicle.ownershipType === ownership,
    })),
    ...fuels.map((fuel) => ({
      id: `fuel:${fuel}`,
      label: FUEL_TYPE_LABELS[fuel],
      match: (vehicle: Vehicle) => vehicle.fuelType === fuel,
    })),
  ];
}

const addVehicle = (
  <Button asChild>
    <Link to="/garage/new">
      <Plus data-icon="inline-start" />
      Add vehicle
    </Link>
  </Button>
);

export function Component() {
  const { vehicles, activeVehicle, setActiveVehicleId, isPending, isError, error, refetch } =
    useActiveVehicle();
  const archived = useVehicles({ archived: true });
  const restore = useRestoreVehicle();
  const [filterId, setFilterId] = useState("all");

  const archivedVehicles = archived.data ?? [];
  // Falls back to "All" once the last archived vehicle is restored.
  const showingArchived = filterId === "archived" && archivedVehicles.length > 0;
  const filters = filtersFor(vehicles);
  const filter = filters.find((candidate) => candidate.id === filterId) ?? filters[0]!;
  const shown = showingArchived ? archivedVehicles : vehicles.filter(filter.match);
  const activeFilterId = showingArchived ? "archived" : filter.id;
  const totalKm = vehicles.reduce((sum, vehicle) => sum + vehicle.odometerKm, 0);

  const description = isPending
    ? "Loading your vehicles…"
    : vehicles.length === 0
      ? archivedVehicles.length
        ? "No vehicles in use"
        : "No vehicles yet"
      : `${formatNumber(vehicles.length)} ${vehicles.length === 1 ? "vehicle" : "vehicles"} · ${formatDistance(totalKm)} on the clock`;

  return (
    <PageContainer>
      <PageHeader title="Your garage" description={description} actions={addVehicle} />

      {isError ? (
        <ErrorState
          title="Couldn't load your garage"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <VehicleCardSkeleton />
          <VehicleCardSkeleton />
        </div>
      ) : vehicles.length === 0 && archivedVehicles.length === 0 ? (
        <GarageEmptyState />
      ) : (
        <>
          <div
            role="group"
            aria-label="Filter vehicles"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {[
              ...filters.map((chip) => ({
                ...chip,
                count: vehicles.filter(chip.match).length,
              })),
              ...(archivedVehicles.length
                ? [{ id: "archived", label: "Archived", count: archivedVehicles.length }]
                : []),
            ].map((chip) => (
              <Button
                key={chip.id}
                variant="outline"
                size="sm"
                aria-pressed={chip.id === activeFilterId}
                onClick={() => setFilterId(chip.id)}
                className={cn(
                  "shrink-0",
                  chip.id === activeFilterId &&
                    "border-primary bg-secondary text-primary hover:text-primary",
                )}
              >
                {chip.label} ({formatNumber(chip.count)})
              </Button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              className="rounded-xl border border-dashed"
              icon={Car}
              title="No vehicles here"
              description="Every vehicle you use is archived. Restore one from the Archived filter or add a new one."
              action={addVehicle}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {shown.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  isActive={vehicle.id === activeVehicle?.id}
                  onSetActive={() => setActiveVehicleId(vehicle.id)}
                  onRestore={() => restore.mutate(vehicle.id)}
                  isRestoring={restore.isPending && restore.variables === vehicle.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

/** First visit (Stitch "Garage — Empty State"). */
function GarageEmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border bg-card p-6 text-center sm:p-10">
      <VehicleImage
        make=""
        model=""
        showLabel={false}
        className="h-36 w-64 max-w-full rounded-xl border"
      />
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight">No vehicles yet</h2>
        <p className="text-sm text-muted-foreground">
          Add your first vehicle to start tracking fuel, expenses, service and documents.
        </p>
      </div>
      {addVehicle}
    </div>
  );
}
