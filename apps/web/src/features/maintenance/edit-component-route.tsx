import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ComponentForm } from "@/features/maintenance/components/component-form";
import { editComponentForm } from "@/features/maintenance/components/component-form-model";
import { useComponent, useUpdateComponent } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/components/:componentId/edit`: a part of the active vehicle (profile only). */
export function Component() {
  const { componentId = "" } = useParams();
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const part = useComponent(vehicle?.id ?? "", componentId);
  const update = useUpdateComponent(vehicle?.id ?? "", componentId);

  if (garage.isPending || (vehicle && part.isPending))
    return <LoadingState fullScreen label="Loading…" />;
  if (!vehicle || !part.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Component not found"
        description="It may have been deleted, or it belongs to another vehicle."
        action={
          <Button variant="outline" asChild>
            <Link to="/maintenance/components">Back to components</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ComponentForm
      mode="edit"
      vehicle={vehicle}
      defaultValues={editComponentForm(part.data)}
      backTo={`/maintenance/components/${componentId}`}
      onSave={(values) => update.mutateAsync(values)}
    />
  );
}
