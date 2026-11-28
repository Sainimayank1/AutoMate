import type { VehicleTransfer } from "@automate/shared";
import { CircleAlert, Inbox } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTransferAction, useTransfers } from "@/features/garage/hooks/use-transfers";
import { normalizeApiError } from "@/lib/api-error";
import { formatDate, formatRegistration } from "@/utils/format";

const COMES_WITH = ["Fill-ups", "Expenses", "Service records", "Documents", "Trips & files"];

/**
 * Stitch "Incoming Transfer — Desktop / Mobile": vehicles other accounts offered you, on top of
 * the Garage. Accepting moves the vehicle in and opens it; a refusal (say, the registration is
 * already yours) shows on the card.
 */
export function IncomingTransfers() {
  const incoming = useTransfers("incoming");
  const open = (incoming.data?.items ?? []).filter((item) => item.status === "PENDING");
  if (!open.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {open.map((transfer) => (
        <TransferCard key={transfer.id} transfer={transfer} />
      ))}
    </div>
  );
}

function TransferCard({ transfer }: { transfer: VehicleTransfer }) {
  const action = useTransferAction();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const act = (kind: "accept" | "decline") => {
    setError(null);
    action.mutate(
      { id: transfer.id, action: kind },
      {
        onSuccess: (done) => {
          if (kind === "accept") {
            toast.success(`${transfer.vehicleName} is now in your garage.`);
            if (done.vehicleId) void navigate(`/garage/${done.vehicleId}`);
          } else {
            toast.success("Transfer declined.");
          }
        },
        onError: (failure) => setError(normalizeApiError(failure).message),
      },
    );
  };
  const sender = transfer.otherParty.name
    ? `${transfer.otherParty.name} (${transfer.otherParty.email})`
    : transfer.otherParty.email;
  const busy = action.isPending;

  return (
    <section
      aria-labelledby={`transfer-${transfer.id}`}
      className="flex flex-col gap-4 rounded-xl border border-primary/50 bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-primary">
            <Inbox className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <Badge variant="secondary" className="bg-warning/15 text-warning tabular-nums">
              Expires {formatDate(transfer.expiresAt)}
            </Badge>
            <h2
              id={`transfer-${transfer.id}`}
              className="mt-1.5 font-heading text-lg font-medium text-balance [overflow-wrap:anywhere]"
            >
              {sender} wants to move {transfer.vehicleName} ·{" "}
              {formatRegistration(transfer.registrationNumber)} to your garage
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Comes with fill-ups, expenses, service records, documents, trips and their files.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" disabled={busy} onClick={() => act("decline")}>
            Decline
          </Button>
          <Button disabled={busy} onClick={() => act("accept")}>
            {busy && action.variables?.action === "accept" && <Spinner data-icon="inline-start" />}
            Accept vehicle
          </Button>
        </div>
      </div>
      <ul className="flex flex-wrap gap-2 border-t pt-3" aria-label="What comes with it">
        {COMES_WITH.map((item) => (
          <li key={item}>
            <Badge variant="outline">{item}</Badge>
          </li>
        ))}
      </ul>
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
