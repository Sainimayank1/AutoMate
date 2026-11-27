import { normalizeRegistration, type Vehicle } from "@automate/shared";
import { Archive } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { vehicleName } from "@/features/garage/constants";
import { useDeleteVehicle } from "@/features/garage/hooks/use-vehicles";
import { formatRegistration } from "@/utils/format";

type DeleteVehicleDialogProps = {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Offered as the safer alternative. */
  onArchiveInstead: () => void;
};

/** Stitch "Delete Vehicle Dialog": the user types the registration before the delete unlocks. */
export function DeleteVehicleDialog({
  vehicle,
  open,
  onOpenChange,
  onArchiveInstead,
}: DeleteVehicleDialogProps) {
  const [typed, setTyped] = useState("");
  const remove = useDeleteVehicle();
  const navigate = useNavigate();
  const plate = formatRegistration(vehicle.registrationNumber);
  const confirmed = normalizeRegistration(typed) === vehicle.registrationNumber;

  function close(next: boolean) {
    if (remove.isPending) return;
    if (!next) setTyped("");
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {vehicleName(vehicle)}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the vehicle and everything recorded for it. This can't be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="flex items-center gap-2 rounded-lg border bg-elevated px-3 py-2 text-sm text-muted-foreground">
          <Archive className="size-4 shrink-0" aria-hidden />
          <span>
            Want to keep the history?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 underline"
              onClick={() => {
                close(false);
                onArchiveInstead();
              }}
            >
              Archive it instead
            </Button>
          </span>
        </p>

        <Field>
          <FieldLabel htmlFor="confirm-registration">
            Type <span className="font-mono">{plate}</span> to confirm
          </FieldLabel>
          <Input
            id="confirm-registration"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={plate}
            autoComplete="off"
            spellCheck={false}
            className="h-10 font-mono uppercase"
          />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || remove.isPending}
            onClick={(event) => {
              event.preventDefault(); // stay open until the request settles
              remove.mutate(vehicle, {
                onSuccess: () => navigate("/garage", { replace: true }),
              });
            }}
          >
            {remove.isPending && <Spinner data-icon="inline-start" />}
            Delete vehicle
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
