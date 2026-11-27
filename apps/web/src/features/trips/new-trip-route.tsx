import { istToday } from "@automate/shared";
import { Car } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { TripForm } from "@/features/trips/components/trip-form";
import { duplicateTripForm, newTripForm } from "@/features/trips/components/trip-form-model";
import { useCreateTrip, useTrip } from "@/features/trips/hooks/use-trips";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/trips/new[?vehicle=<id> | ?duplicate=<tripId>]`: log a trip (a copy keeps route and type). */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = useVehicles();
  const [params] = useSearchParams();
  const duplicateId = params.get("duplicate") ?? "";
  const source = useTrip(duplicateId);
  const create = useCreateTrip();
  // One id per visit: a retried save returns the trip it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (garage.isPending || vehicles.isPending || (duplicateId && source.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  const list = vehicles.data ?? [];
  if (list.length === 0) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Trips are recorded per vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  const today = istToday(new Date());
  const vehicle =
    list.find((item) => item.id === (source.data?.vehicleId ?? params.get("vehicle"))) ??
    list.find((item) => item.id === garage.activeVehicle?.id) ??
    list[0]!;
  return (
    <TripForm
      mode="create"
      vehicles={list}
      defaultValues={
        source.data
          ? duplicateTripForm(source.data, today, vehicle.odometerKm)
          : newTripForm(today, vehicle.id, vehicle.odometerKm)
      }
      backTo={source.data ? `/trips/${source.data.id}` : "/trips"}
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}
