import type { MaintenanceSchedule } from "@automate/shared";
import { Eye, MoreVertical, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteSchedule, usePauseSchedule } from "@/features/maintenance/hooks/use-maintenance";

/** Stitch "Maintenance Schedules" row menu: View, Edit, Pause or Resume, Delete (confirmed). */
export function ScheduleActions({
  schedule,
  showView = true,
  onDeleted,
}: {
  schedule: MaintenanceSchedule;
  showView?: boolean;
  onDeleted?: () => void;
}) {
  const pause = usePauseSchedule();
  const remove = useDeleteSchedule();
  const [deleting, setDeleting] = useState(false);
  const paused = schedule.pausedAt !== null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${schedule.name}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showView && (
            <DropdownMenuItem asChild>
              <Link to={`/maintenance/schedules/${schedule.id}`}>
                <Eye />
                View
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={`/maintenance/schedules/${schedule.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pause.isPending}
            onSelect={() => pause.mutate({ schedule, paused: !paused })}
          >
            {paused ? <Play /> : <Pause />}
            {paused ? "Resume" : "Pause"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${schedule.name}?`}
        description="The schedule is removed. Service records you've logged are kept."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(schedule);
          onDeleted?.();
        }}
      />
    </>
  );
}
