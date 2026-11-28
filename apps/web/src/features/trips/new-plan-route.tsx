import { istToday } from "@automate/shared";
import { Car } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useFuelSummary } from "@/features/fuel/hooks/use-fuel";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { PlanForm } from "@/features/trips/components/plan-form";
import { newPlanForm } from "@/features/trips/components/plan-form-model";
import { useCreateTripPlan } from "@/features/trips/hooks/use-trip-plans";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/trips/plan[?vehicle=<id>]`: plan a trip; the budget starts from the vehicle's fuel figures. */
export function Component() {
  const garage = useActiveVehicle();
  const vehicles = useVehicles();
  const [params] = useSearchParams();
  const list = vehicles.data ?? [];
  const vehicle =
    list.find((item) => item.id === params.get("vehicle")) ??
    list.find((item) => item.id === garage.activeVehicle?.id) ??
    list[0];
  const fuel = useFuelSummary(vehicle?.id);
  const create = useCreateTripPlan();
  // One id per visit: a retried save returns the plan it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (garage.isPending || vehicles.isPending || (vehicle && fuel.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (!vehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Trips are planned per vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <PlanForm
      vehicles={list}
      defaultValues={newPlanForm(istToday(new Date()), vehicle.id, fuel.data)}
      backTo="/trips/planner"
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}
