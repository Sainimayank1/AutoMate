import { Car } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { FuelEntryForm } from "@/features/fuel/components/fuel-entry-form";
import { newFuelForm } from "@/features/fuel/components/fuel-form-model";
import { useCreateFuelEntry, useFuelEntries } from "@/features/fuel/hooks/use-fuel";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/fuel/new[?vehicle=<id>]`: log a fill-up, for the active vehicle unless another is named. */
export function Component() {
  const { vehicles, activeVehicle, isPending, isError, error, refetch } = useActiveVehicle();
  const [params] = useSearchParams();
  const vehicle = vehicles.find((item) => item.id === params.get("vehicle")) ?? activeVehicle;
  // For the last price and payment method; the form still opens if this fails.
  const history = useFuelEntries(vehicle?.id);
  const create = useCreateFuelEntry();

  if (isPending || (vehicle && history.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (isError) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load your garage"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!vehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Fill-ups are logged against a vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <FuelEntryForm
      mode="create"
      vehicles={vehicles}
      defaultValues={newFuelForm(vehicle, history.data)}
      onSave={({ vehicleId, ...values }) => create.mutateAsync({ vehicleId, values })}
    />
  );
}
