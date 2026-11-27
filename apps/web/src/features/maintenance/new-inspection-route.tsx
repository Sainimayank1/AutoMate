import { istToday } from "@automate/shared";
import { Car } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { InspectionForm } from "@/features/maintenance/components/inspection-form";
import { newInspectionForm } from "@/features/maintenance/components/inspection-form-model";
import { useComponents, useCreateInspection } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/inspections/new`: record a checklist inspection of the active vehicle. */
export function Component() {
  const { activeVehicle, isPending } = useActiveVehicle();
  const parts = useComponents(activeVehicle?.id, { pageSize: 100 });
  const create = useCreateInspection(activeVehicle?.id ?? "");
  // One id per visit: a retried save returns the inspection it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (isPending) return <LoadingState fullScreen label="Loading…" />;
  if (!activeVehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Inspections are recorded per vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <InspectionForm
      mode="create"
      vehicle={activeVehicle}
      components={parts.data?.items ?? []}
      defaultValues={newInspectionForm(istToday(new Date()))}
      backTo="/maintenance/inspections"
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}
