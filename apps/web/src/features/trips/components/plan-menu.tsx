import { tripLabel, type TripPlan } from "@automate/shared";
import { CircleCheck, MoreVertical, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";
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
import { CompletePlanDialog } from "@/features/trips/components/complete-plan-dialog";
import { useCancelTripPlan, useDeleteTripPlan } from "@/features/trips/hooks/use-trip-plans";

/**
 * A plan's actions: edit, mark as done, cancel or restore, delete. `inline` shows Mark as done
 * and Edit as buttons beside the menu (the details page); a card shows only the menu.
 */
export function PlanMenu({
  plan,
  inline = false,
  onDeleted,
}: {
  plan: TripPlan;
  inline?: boolean;
  onDeleted?: () => void;
}) {
  const cancel = useCancelTripPlan();
  const remove = useDeleteTripPlan();
  const [completing, setCompleting] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const cancelled = plan.status === "CANCELLED";
  const label = tripLabel(plan);

  return (
    <>
      {inline && !cancelled && (
        <>
          <Button onClick={() => setCompleting(true)}>
            <CircleCheck data-icon="inline-start" />
            Mark as done
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/trips/planner/${plan.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
          </Button>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={inline ? "outline" : "ghost"}
            size="icon"
            aria-label={`Actions for ${label}`}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!cancelled && !inline && (
            <>
              <DropdownMenuItem asChild>
                <Link to={`/trips/planner/${plan.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCompleting(true)}>
                <CircleCheck />
                Mark as done
              </DropdownMenuItem>
            </>
          )}
          {cancelled ? (
            <DropdownMenuItem onSelect={() => cancel.mutate({ id: plan.id, cancelled: false })}>
              <RotateCcw />
              Restore plan
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")}>
              <XCircle />
              Cancel plan
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompletePlanDialog plan={plan} open={completing} onOpenChange={setCompleting} />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Cancel "${label}"?`}
        description="It moves to Cancelled in the planner; you can restore it later."
        confirmLabel="Cancel plan"
        cancelLabel="Keep plan"
        onConfirm={async () => {
          await cancel.mutateAsync({ id: plan.id, cancelled: true });
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete "${label}"?`}
        description="The plan and its budget are deleted. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(plan.id);
          onDeleted?.();
        }}
      />
    </>
  );
}
