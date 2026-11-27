import type { DashboardMaintenance } from "@automate/shared";
import { Wrench } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DueSummary, ScheduleStatusBadge } from "@/features/maintenance/components/schedule-due";
import { formatDateRange, formatDistance, formatNumber } from "@/utils/format";

/**
 * Stitch "Dashboard" maintenance: overdue and due counts, the most urgent schedules (the
 * Maintenance module's own due rules: time or distance, whichever comes first) and the last
 * service. Nothing here is computed: it all comes from the Maintenance module.
 */
export function MaintenanceCard({
  maintenance,
  vehicleId,
}: {
  maintenance: DashboardMaintenance;
  vehicleId: string;
}) {
  const { overdue, dueSoon, schedules, lastService } = maintenance;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
        <p className="text-sm tabular-nums">
          {overdue || dueSoon ? (
            <>
              {overdue > 0 && (
                <span className="text-destructive">{formatNumber(overdue)} overdue</span>
              )}
              {overdue > 0 && dueSoon > 0 && <span className="text-muted-foreground"> · </span>}
              {dueSoon > 0 && (
                <span className="text-warning">{formatNumber(dueSoon)} due soon</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Nothing due on your schedules</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {schedules.length > 0 && (
          <ul className="flex flex-col divide-y">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <Link
                  to={`/maintenance/schedules/${schedule.id}`}
                  className="flex flex-col gap-1.5 rounded-md py-2.5 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{schedule.name}</span>
                    <ScheduleStatusBadge due={schedule.due} />
                  </span>
                  <DueSummary schedule={schedule} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {lastService && (
          <p className="text-sm text-muted-foreground">
            Last service:{" "}
            <Link
              to={`/maintenance/records/${vehicleId}/${lastService.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {lastService.title}
            </Link>{" "}
            · {formatDateRange({ from: lastService.serviceDate, to: lastService.serviceDate })}
            {lastService.odometerKm !== null && ` · ${formatDistance(lastService.odometerKm)}`}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
          <Link to="/maintenance/records/new" className="text-primary hover:underline">
            Add service record
          </Link>
          <Link to="/maintenance" className="text-primary hover:underline">
            View maintenance
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/** No schedule and no service record yet. */
export function MaintenanceSetup() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-start gap-3">
        <Wrench className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Add a service schedule and AutoMate will tell you when it&apos;s due, by date or km,
          whichever comes first.
        </p>
        <Button asChild size="sm" variant="outline" className="max-md:h-10">
          <Link to="/maintenance/schedules/new">Add a schedule</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
