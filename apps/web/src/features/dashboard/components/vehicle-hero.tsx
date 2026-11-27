import type { Vehicle } from "@automate/shared";
import { Fuel, Gauge, ReceiptIndianRupee, Wrench } from "lucide-react";
import { Link } from "react-router";

import { PlateBadge } from "@/components/common/plate-badge";
import { VehicleImage } from "@/components/common/vehicle-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
  vehicleName,
} from "@/features/garage/constants";
import { formatDistance, formatRegistration } from "@/utils/format";

const label = "text-xs font-semibold tracking-wider uppercase";

/**
 * Stitch "Dashboard" vehicle hero: the active vehicle, its odometer and the quick actions that
 * exist today (Log trip and Add document join when Trips and Documents are built). Deviation: the design system's vehicle visual instead of a photo (photos need file
 * storage, not in this project).
 */
export function VehicleHero({ vehicle }: { vehicle: Vehicle }) {
  const specs = [
    vehicle.variant,
    vehicle.engineCapacityCc && `${(vehicle.engineCapacityCc / 1000).toFixed(1)}L`,
    FUEL_TYPE_LABELS[vehicle.fuelType],
    TRANSMISSION_LABELS[vehicle.transmission],
    vehicle.manufacturingYear,
  ]
    .filter(Boolean)
    .join(" · ");
  const action = "max-md:h-10";
  return (
    <section
      aria-label="Active vehicle"
      className="grid h-full overflow-hidden rounded-xl border bg-card md:grid-cols-12"
    >
      <VehicleImage
        make={vehicle.make}
        model={vehicle.model}
        showLabel={false}
        className="min-h-48 md:col-span-5 md:min-h-56"
      >
        <PlateBadge
          value={formatRegistration(vehicle.registrationNumber)}
          className="absolute right-4 bottom-4"
        />
      </VehicleImage>
      <div className="flex flex-col justify-between gap-5 p-5 md:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={`${label} text-primary`}>Active vehicle</span>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
              {vehicleName(vehicle)}
            </h2>
            {specs && <p className="mt-0.5 text-sm text-muted-foreground">{specs}</p>}
            <Badge variant="outline" className="mt-2 text-muted-foreground">
              {OWNERSHIP_LABELS[vehicle.ownershipType]}
            </Badge>
          </div>
          <div>
            <span className={`${label} block text-muted-foreground`}>Odometer</span>
            <span className="mt-0.5 block font-mono text-lg font-semibold tabular-nums">
              {formatDistance(vehicle.odometerKm)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 border-t pt-4">
          <span className={`${label} text-muted-foreground`}>Quick actions</span>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className={action}>
              <Link to="/fuel/new">
                <Fuel data-icon="inline-start" />
                Add fuel
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className={action}>
              <Link to="/expenses/new">
                <ReceiptIndianRupee data-icon="inline-start" />
                Add expense
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className={action}>
              <Link to="/maintenance/records/new">
                <Wrench data-icon="inline-start" />
                Add service record
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className={action}>
              <Link to={`/garage/${vehicle.id}/edit`}>
                <Gauge data-icon="inline-start" />
                Update odometer
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className={action}>
              <Link to={`/garage/${vehicle.id}`}>View in Garage</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
