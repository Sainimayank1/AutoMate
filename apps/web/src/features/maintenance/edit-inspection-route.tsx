import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { InspectionForm } from "@/features/maintenance/components/inspection-form";
import { editInspectionForm } from "@/features/maintenance/components/inspection-form-model";
import {
  useComponents,
  useInspection,
  useUpdateInspection,
} from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/inspections/:inspectionId/edit`: an inspection of the active vehicle. */
export function Component() {
  const { inspectionId = "" } = useParams();
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const inspection = useInspection(vehicle?.id ?? "", inspectionId);
  const parts = useComponents(vehicle?.id, { pageSize: 100 });
  const update = useUpdateInspection(vehicle?.id ?? "", inspectionId);

  if (garage.isPending || (vehicle && inspection.isPending))
    return <LoadingState fullScreen label="Loading…" />;
  if (!vehicle || !inspection.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Inspection not found"
        description="It may have been deleted, or it belongs to another vehicle."
        action={
          <Button variant="outline" asChild>
            <Link to="/maintenance/inspections">Back to inspections</Link>
          </Button>
        }
      />
    );
  }
  return (
    <InspectionForm
      mode="edit"
      vehicle={vehicle}
      // Fitted parts, plus any a finding names that has since been replaced or removed.
      components={[
        ...(parts.data?.items ?? []),
        ...inspection.data.items.flatMap((item) =>
          item.componentId &&
          item.componentName &&
          !parts.data?.items.some((part) => part.id === item.componentId)
            ? [{ id: item.componentId, name: `${item.componentName} (no longer fitted)` }]
            : [],
        ),
      ].filter((part, index, all) => all.findIndex((other) => other.id === part.id) === index)}
      defaultValues={editInspectionForm(inspection.data)}
      backTo={`/maintenance/inspections/${inspectionId}`}
      onSave={(values) => update.mutateAsync(values)}
    />
  );
}
