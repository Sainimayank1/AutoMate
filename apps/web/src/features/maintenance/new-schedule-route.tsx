import { Car } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ScheduleForm } from "@/features/maintenance/components/schedule-form";
import {
  newScheduleForm,
  scheduleFromFinding,
} from "@/features/maintenance/components/schedule-form-model";
import { useCreateSchedule, useInspection } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/**
 * `/maintenance/schedules/new[?inspection=<id>&item=<itemId>]`: add a schedule to the active
 * vehicle; from an inspection finding it is prefilled and linked to that finding.
 */
export function Component() {
  const { activeVehicle, isPending, isError, data, error, refetch } = useActiveVehicle();
  const [params] = useSearchParams();
  const inspectionId = params.get("inspection") ?? "";
  const inspection = useInspection(activeVehicle?.id ?? "", inspectionId);
  const create = useCreateSchedule(activeVehicle?.id ?? "");
  // One id per visit: a retried save returns the schedule it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (isPending || (activeVehicle && inspectionId && inspection.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
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
  // A finding already followed up isn't linked twice.
  const finding = inspection.data?.items.find(
    (item) => item.id === params.get("item") && !item.followUpSchedule,
  );
  return (
    <ScheduleForm
      mode="create"
      vehicle={activeVehicle}
      defaultValues={
        finding
          ? scheduleFromFinding(inspection.data!, finding)
          : { ...newScheduleForm(), ...(params.get("once") && { kind: "ONCE" as const }) }
      }
      backTo={finding ? `/maintenance/inspections/${inspectionId}` : undefined}
      onSave={(values) =>
        create.mutateAsync({ ...values, id, ...(finding && { inspectionItemId: finding.id }) })
      }
    />
  );
}
