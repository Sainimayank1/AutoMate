import { istToday } from "@automate/shared";
import { Car } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { RecordForm } from "@/features/maintenance/components/record-form";
import { newRecordForm } from "@/features/maintenance/components/record-form-model";
import { useCreateServiceRecord, useSchedules } from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/** `/maintenance/records/new[?schedule=<id>]`: log a service for the active vehicle. */
export function Component() {
  const { activeVehicle, isPending, isError, data, error, refetch } = useActiveVehicle();
  const [params] = useSearchParams();
  const schedules = useSchedules(activeVehicle?.id, { pageSize: 100 });
  const create = useCreateServiceRecord(activeVehicle?.id ?? "");
  // One id per visit: a retried save returns the record it already made.
  const [id] = useState(() => crypto.randomUUID());

  if (isPending || (activeVehicle && schedules.isPending)) {
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
  const list = schedules.data?.items ?? [];
  const completing = list.find((schedule) => schedule.id === params.get("schedule"));
  return (
    <RecordForm
      mode="create"
      vehicle={activeVehicle}
      schedules={list}
      completing={completing}
      defaultValues={newRecordForm(istToday(new Date()), completing)}
      backTo={completing ? `/maintenance/schedules/${completing.id}` : "/maintenance"}
      onSave={(values) => create.mutateAsync({ ...values, id })}
    />
  );
}
