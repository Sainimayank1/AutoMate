import { tripLabel } from "@automate/shared";
import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ItineraryEditor } from "@/features/trips/components/itinerary-editor";
import { useTripPlan, useUpdateTripPlan } from "@/features/trips/hooks/use-trip-plans";
import { formatDistance } from "@/utils/format";

/** `/trips/planner/:planId/itinerary`: a planned road trip's days, stay times and nights. */
export function Component() {
  const { planId = "" } = useParams();
  const plan = useTripPlan(planId);
  const update = useUpdateTripPlan(planId);

  if (plan.isPending) return <LoadingState fullScreen label="Loading…" />;
  if (!plan.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Plan not found"
        description="It may have been deleted or already done."
        action={
          <Button variant="outline" asChild>
            <Link to="/trips/planner">Back to the planner</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ItineraryEditor
      trip={{
        ...plan.data,
        label: tripLabel(plan.data),
        distanceText: plan.data.plannedDistanceKm
          ? `${formatDistance(plan.data.plannedDistanceKm)} planned`
          : null,
      }}
      backTo={`/trips/planner/${planId}`}
      onSave={(stops) => update.mutateAsync({ stops })}
    />
  );
}
