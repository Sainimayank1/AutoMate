import { Fuel } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { FuelEntryForm } from "@/features/fuel/components/fuel-entry-form";
import { toFuelForm } from "@/features/fuel/components/fuel-form-model";
import { useFuelEntry, useUpdateFuelEntry } from "@/features/fuel/hooks/use-fuel";
import { useVehicle } from "@/features/garage/hooks/use-vehicles";

/** `/fuel/:vehicleId/:entryId/edit`: the add form, filled in; the vehicle can't change. */
export function Component() {
  const { vehicleId = "", entryId = "" } = useParams();
  const vehicle = useVehicle(vehicleId);
  const entry = useFuelEntry(vehicleId, entryId);
  const update = useUpdateFuelEntry(vehicleId, entryId);

  if (vehicle.isPending || entry.isPending) {
    return <LoadingState fullScreen label="Loading fill-up…" />;
  }
  if (!vehicle.data || !entry.data) {
    const error = vehicle.error ?? entry.error;
    return error?.status === 404 || error?.status === 400 ? (
      <EmptyState
        className="min-h-svh"
        icon={Fuel}
        title="Fill-up not found"
        description="It may have been deleted, or it isn't in your garage."
        action={
          <Button asChild>
            <Link to="/fuel">Back to fuel</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load this fill-up"
        error={error}
        onRetry={() => void Promise.all([vehicle.refetch(), entry.refetch()])}
      />
    );
  }
  return (
    <FuelEntryForm
      // Keyed: a different entry starts a fresh form.
      key={entry.data.id}
      mode="edit"
      vehicles={[vehicle.data]}
      defaultValues={toFuelForm(entry.data)}
      editingId={entryId}
      onSave={({ vehicleId: _vehicleId, ...values }) => update.mutateAsync(values)}
    />
  );
}
