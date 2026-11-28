import { tripLabel } from "@automate/shared";
import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ItineraryEditor } from "@/features/trips/components/itinerary-editor";
import { useTrip, useUpdateTrip } from "@/features/trips/hooks/use-trips";
import { formatDistance } from "@/utils/format";

/** `/trips/:tripId/itinerary`: a done trip's days, stay times and nights. */
export function Component() {
  const { tripId = "" } = useParams();
  const trip = useTrip(tripId);
  const update = useUpdateTrip(tripId);

  if (trip.isPending) return <LoadingState fullScreen label="Loading…" />;
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
    <ItineraryEditor
      trip={{
        ...trip.data,
        label: tripLabel(trip.data),
        distanceText: formatDistance(trip.data.distanceKm),
      }}
      backTo={`/trips/${tripId}`}
      onSave={(stops) => update.mutateAsync({ stops })}
    />
  );
}
