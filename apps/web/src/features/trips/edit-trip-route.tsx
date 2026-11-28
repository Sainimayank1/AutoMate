import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { TripForm } from "@/features/trips/components/trip-form";
import { editTripForm } from "@/features/trips/components/trip-form-model";
import { useTrip, useUpdateTrip } from "@/features/trips/hooks/use-trips";

/** `/trips/:tripId/edit`: change a trip (its vehicle stays). */
export function Component() {
  const { tripId = "" } = useParams();
  const trip = useTrip(tripId);
  // Archived vehicles too, so a trip of one still shows its vehicle (the API refuses the save).
  const active = useVehicles();
  const archived = useVehicles({ archived: true });
  const update = useUpdateTrip(tripId);

  if (trip.isPending || active.isPending) return <LoadingState fullScreen label="Loading…" />;
  if (!trip.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Trip not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link to="/trips">Back to trips</Link>
          </Button>
        }
      />
    );
  }
  return (
    <TripForm
      mode="edit"
      vehicles={[...(active.data ?? []), ...(archived.data ?? [])]}
      defaultValues={editTripForm(trip.data)}
      storedRoute={trip.data.route}
      backTo={`/trips/${tripId}`}
      onSave={({ vehicleId: _, ...values }) => update.mutateAsync(values)}
    />
  );
}
