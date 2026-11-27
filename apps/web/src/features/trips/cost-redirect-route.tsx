import { SearchX } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useTripCost } from "@/features/trips/hooks/use-trips";

/** `/trips/costs/:costId`: where a trip cost's expense ("Edit in Trips") lands; opens its trip. */
export function Component() {
  const { costId = "" } = useParams();
  const cost = useTripCost(costId);
  if (cost.isPending) return <LoadingState label="Opening the trip…" />;
  if (!cost.data) {
    return (
      <EmptyState
        className="rounded-xl border border-dashed"
        icon={SearchX}
        title="Trip cost not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link to="/trips">Back to trips</Link>
          </Button>
        }
      />
    );
  }
  return <Navigate to={`/trips/${cost.data.tripId}`} replace />;
}
