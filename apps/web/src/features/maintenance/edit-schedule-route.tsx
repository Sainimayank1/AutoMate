import { SearchX } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ScheduleForm } from "@/features/maintenance/components/schedule-form";
import { editScheduleForm } from "@/features/maintenance/components/schedule-form-model";
import { useSchedule, useUpdateSchedule } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/**
 * `/maintenance/schedules/:scheduleId/edit`: a schedule of the active vehicle. The whole form is
 * sent (switching Repeats ↔ Once clears the other kind's fields); the API merges and re-checks.
 */
export function Component() {
  const { scheduleId = "" } = useParams();
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const schedule = useSchedule(vehicle?.id ?? "", scheduleId, !!vehicle);
  const update = useUpdateSchedule(vehicle?.id ?? "", scheduleId);

  if (garage.isPending || (vehicle && schedule.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (!vehicle || !schedule.data) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Schedule not found"
        description="It may have been deleted, or it belongs to another vehicle."
        action={
          <Button variant="outline" asChild>
            <Link to="/maintenance/schedules">Back to schedules</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ScheduleForm
      mode="edit"
      vehicle={vehicle}
      defaultValues={editScheduleForm(schedule.data)}
      onSave={(values) => update.mutateAsync(values)}
    />
  );
}
