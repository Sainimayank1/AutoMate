import { CalendarPlus, Wrench } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function AddScheduleButton({
  label = "Add schedule",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild variant={variant}>
      <Link to="/maintenance/schedules/new">
        <CalendarPlus data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}

/** "Log service": a new service record, optionally completing a schedule. */
export function LogServiceButton({
  scheduleId,
  label = "Log service",
  variant = "default",
}: {
  scheduleId?: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild variant={variant}>
      <Link to={`/maintenance/records/new${scheduleId ? `?schedule=${scheduleId}` : ""}`}>
        <Wrench data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}
