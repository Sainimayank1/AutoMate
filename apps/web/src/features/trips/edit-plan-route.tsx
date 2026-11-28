import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { PlanForm } from "@/features/trips/components/plan-form";
import { editPlanForm } from "@/features/trips/components/plan-form-model";
import { useTripPlan, useUpdateTripPlan } from "@/features/trips/hooks/use-trip-plans";

/** `/trips/planner/:planId/edit`: change a plan (its vehicle stays). */
export function Component() {
  const { planId = "" } = useParams();
  const plan = useTripPlan(planId);
  const active = useVehicles();
  const archived = useVehicles({ archived: true });
  const update = useUpdateTripPlan(planId);

  if (plan.isPending || active.isPending) return <LoadingState fullScreen label="Loading…" />;
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
    <PlanForm
      plan={plan.data}
      vehicles={[...(active.data ?? []), ...(archived.data ?? [])]}
      defaultValues={editPlanForm(plan.data)}
      backTo={`/trips/planner/${planId}`}
      onSave={({ vehicleId: _, ...values }) => update.mutateAsync(values)}
    />
  );
}
