import { Car } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ComponentForm } from "@/features/maintenance/components/component-form";
import { newComponentForm } from "@/features/maintenance/components/component-form-model";
import { useCreateComponent } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/components/new`: start tracking a part of the active vehicle. */
export function Component() {
  const { activeVehicle, isPending } = useActiveVehicle();
  const create = useCreateComponent(activeVehicle?.id ?? "");
  // One id per visit: a retried save returns the part it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (isPending) return <LoadingState fullScreen label="Loading…" />;
  if (!activeVehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Components are tracked per vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ComponentForm
      mode="create"
      vehicle={activeVehicle}
      defaultValues={newComponentForm()}
      backTo="/maintenance/components"
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}
