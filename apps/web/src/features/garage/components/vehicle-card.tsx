import type { Vehicle } from "@automate/shared";
import { cn } from "cn";
import { RotateCcw } from "lucide-react";
import { Link } from "react-router";

import { PlateBadge } from "@/components/common/plate-badge";
import { VehicleImage } from "@/components/common/vehicle-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  vehicleName,
  vehicleSummary,
} from "@/features/garage/constants";
import { formatDistance } from "@/utils/format";

type VehicleCardProps = {
  vehicle: Vehicle;
  isActive: boolean;
  onSetActive: () => void;
  onRestore: () => void;
  isRestoring?: boolean;
};

/** Garage grid card (Stitch "Garage"). Mileage and service status join when Fuel and Maintenance exist. */
export function VehicleCard({
  vehicle,
  isActive,
  onSetActive,
  onRestore,
  isRestoring,
}: VehicleCardProps) {
  const isArchived = vehicle.archivedAt !== null;

  return (
    <article
      aria-label={vehicleName(vehicle)}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        isActive && !isArchived && "border-primary/50",
      )}
    >
      <VehicleImage
        make={vehicle.make}
        model={vehicle.model}
        showLabel={false}
        className={cn("h-44 sm:h-60", isArchived && "opacity-60")}
      >
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
          {isArchived ? (
            <Badge variant="secondary">Archived</Badge>
          ) : isActive ? (
            <Badge>
              <span className="size-1.5 rounded-full bg-primary-foreground" aria-hidden />
              Active vehicle
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-elevated/90 text-muted-foreground">
              Standby
            </Badge>
          )}
          <PlateBadge value={vehicle.registrationNumber} />
        </div>
        <div className="absolute inset-x-4 bottom-4">
          <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">
            {vehicleName(vehicle)}
          </h2>
          <p className="text-xs text-muted-foreground">{vehicleSummary(vehicle)}</p>
        </div>
      </VehicleImage>

      <dl className="grid grid-cols-3 gap-4 border-b p-4 sm:p-5">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Odometer</dt>
          <dd className="font-mono text-sm tabular-nums">{formatDistance(vehicle.odometerKm)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Fuel</dt>
          <dd className="text-sm">{FUEL_TYPE_LABELS[vehicle.fuelType]}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Ownership</dt>
          <dd className="text-sm">{OWNERSHIP_LABELS[vehicle.ownershipType]}</dd>
        </div>
      </dl>

      <footer className="flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-xs text-muted-foreground">
          Profile {vehicle.profileCompletion}% complete
        </span>
        <div className="flex items-center gap-2">
          {isArchived ? (
            <Button variant="ghost" size="sm" onClick={onRestore} disabled={isRestoring}>
              <RotateCcw data-icon="inline-start" />
              Restore
            </Button>
          ) : (
            !isActive && (
              <Button variant="ghost" size="sm" className="text-primary" onClick={onSetActive}>
                Set active
              </Button>
            )
          )}
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/garage/${vehicle.id}`} aria-label={`View ${vehicleName(vehicle)}`}>
              View profile
            </Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card" aria-hidden>
      <Skeleton className="h-44 rounded-none sm:h-60" />
      <div className="grid grid-cols-3 gap-4 border-b p-5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}
