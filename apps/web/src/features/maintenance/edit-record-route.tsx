import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import { RecordForm } from "@/features/maintenance/components/record-form";
import { editRecordForm } from "@/features/maintenance/components/record-form-model";
import {
  useSchedules,
  useServiceRecord,
  useUpdateServiceRecord,
} from "@/features/maintenance/hooks/use-maintenance";

/**
 * `/maintenance/records/:vehicleId/:recordId/edit`. The whole form is sent (items replace the
 * list); the API merges and re-checks the record.
 */
export function Component() {
  const { vehicleId = "", recordId = "" } = useParams();
  const vehicles = useVehicles();
  const vehicle = vehicles.data?.find((item) => item.id === vehicleId);
  const record = useServiceRecord(vehicleId, recordId);
  const schedules = useSchedules(vehicleId, { pageSize: 100 });
  const update = useUpdateServiceRecord(vehicleId, recordId);
  const detail = `/maintenance/records/${vehicleId}/${recordId}`;

  if (vehicles.isPending || record.isPending || schedules.isPending) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (!vehicle || !record.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Service record not found"
        description="It may have been deleted, or its vehicle is archived."
        action={
          <Button variant="outline" asChild>
            <Link to="/maintenance">Back to maintenance</Link>
          </Button>
        }
      />
    );
  }
  return (
    <RecordForm
      mode="edit"
      vehicle={vehicle}
      schedules={schedules.data?.items ?? []}
      defaultValues={editRecordForm(record.data)}
      backTo={detail}
      onSave={(values) => update.mutateAsync(values)}
    />
  );
}
