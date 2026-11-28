import { createTransferSchema, type Vehicle } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Send, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { vehicleName } from "@/features/garage/constants";
import {
  useOfferTransfer,
  useTransferAction,
  useTransfers,
} from "@/features/garage/hooks/use-transfers";
import { applyServerErrors } from "@/lib/forms";
import { formatDate, formatRegistration } from "@/utils/format";

const emailSchema = createTransferSchema.pick({ email: true });

/**
 * Stitch "Transfer Vehicle Dialog — Desktop" / "Transfer Vehicle Sheet — Mobile": offer the
 * vehicle, with all its records, to another account's email. The API answers the same whether
 * or not the email has an account.
 */
export function TransferVehicleDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const offer = useOfferTransfer();
  const form = useForm<z.input<typeof emailSchema>, unknown, z.output<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const { isSubmitting, errors } = form.formState;
  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await offer.mutateAsync({ vehicleId: vehicle.id, email });
      toast.success("Transfer request sent.");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer vehicle</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {vehicleName(vehicle)} · {formatRegistration(vehicle.registrationNumber)}
          </DialogDescription>
        </DialogHeader>
        <form id="transfer-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted-foreground">
            The vehicle, with all its records, files, loans and trips, moves to another AutoMate
            account and leaves yours once they accept.
          </p>
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={form.control}
            name="email"
            label="Their account email"
            render={(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="off"
                placeholder="priya@example.com"
                className="h-10"
              />
            )}
          />
          <ul className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              We never say whether an AutoMate account exists for that email.
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              The request expires in 7 days and you can cancel it until then.
            </li>
          </ul>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-form" disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Send transfer request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The vehicle's open outgoing transfer, if any, with a way to withdraw it. */
export function PendingTransfer({ vehicle }: { vehicle: Vehicle }) {
  const outgoing = useTransfers("outgoing");
  const action = useTransferAction();
  const pending = outgoing.data?.items.find(
    (item) => item.status === "PENDING" && item.registrationNumber === vehicle.registrationNumber,
  );
  if (!pending) return null;
  return (
    <Alert className="border-warning/40 bg-warning/10 text-warning">
      <Send />
      <AlertDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-warning">
        <span className="tabular-nums">
          Transfer to {pending.otherParty.email} waiting since {formatDate(pending.createdAt)}
        </span>
        <span aria-hidden>·</span>
        <Button
          variant="link"
          className="h-auto p-0 font-semibold text-warning"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              { id: pending.id, action: "cancel" },
              { onSuccess: () => toast.success("Transfer cancelled.") },
            )
          }
        >
          Cancel transfer
        </Button>
      </AlertDescription>
    </Alert>
  );
}
