import { Car } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ScheduleForm } from "@/features/maintenance/components/schedule-form";
import { newScheduleForm } from "@/features/maintenance/components/schedule-form-model";
import { useCreateSchedule } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/schedules/new`: add a schedule to the active vehicle. */
export function Component() {
  const { activeVehicle, isPending, isError, data, error, refetch } = useActiveVehicle();
  const create = useCreateSchedule(activeVehicle?.id ?? "");
  // One id per visit: a retried save returns the schedule it already made.
  const id = useMemoId();

  if (isPending) return <LoadingState fullScreen label="Loading…" />;
  if (isError && !data) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load your garage"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!activeVehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Maintenance is tracked per vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ScheduleForm
      mode="create"
      vehicle={activeVehicle}
      defaultValues={newScheduleForm()}
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}

function useMemoId() {
  const [id] = useState(() => crypto.randomUUID());
  return id;
}
