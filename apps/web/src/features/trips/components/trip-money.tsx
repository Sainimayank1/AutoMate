import { FUEL_UNIT, type Trip, type TripCost } from "@automate/shared";
import { Fuel, Link2, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { efficiencyUnit } from "@/features/fuel/constants";
import { TripCostDialog } from "@/features/trips/components/trip-cost-dialog";
import { COST_COLORS, COST_LABELS, isVehicleCost } from "@/features/trips/constants";
import {
  useDeleteTripCost,
  useFuelCandidates,
  useLinkFuel,
  useTripCosts,
  useTripFuel,
  useTripSpending,
} from "@/features/trips/hooks/use-trips";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/utils/format";

/**
 * A trip's actual spending (recorded costs and linked fill-ups) and, clearly apart, the fuel
 * estimate from the vehicle's average mileage, which is never counted as spending.
 */
export function SpendingCard({ trip }: { trip: Trip }) {
  const { data } = useTripSpending(trip.id);
  if (!data) return <Skeleton className="h-36 rounded-xl" aria-label="Loading spending" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-12">
        <div className="flex flex-col gap-3 md:col-span-8">
          <div>
            <p className="font-heading text-2xl font-semibold tabular-nums">
              {data.actual ? formatCurrency(data.actual) : "No costs recorded"}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.actual
                ? `Recorded costs and linked fill-ups${data.perKm ? ` · ${formatCurrency(data.perKm)} per km` : ""}`
                : "Add a toll, parking or other cost, or link a fill-up."}
            </p>
          </div>
          {data.byCategory.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {data.byCategory.map((row) => (
                <li key={row.category} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: COST_COLORS[row.category] }}
                    aria-hidden
                  />
                  {COST_LABELS[row.category]}
                  <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-dashed bg-muted/40 p-4 md:col-span-4">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Estimated fuel
          </span>
          {data.estimate ? (
            <>
              <p className="font-medium tabular-nums">
                ~{formatNumber(Number(data.estimate.quantity))} {FUEL_UNIT[data.estimate.fuelType]}
                {data.estimate.cost && ` · ~${formatCurrency(data.estimate.cost)}`}
              </p>
              <p className="text-xs text-muted-foreground">
                From your average mileage {data.estimate.mileage}{" "}
                {efficiencyUnit(data.estimate.fuelType)}
                {data.estimate.price &&
                  ` and average price ${formatCurrency(data.estimate.price)}/${FUEL_UNIT[data.estimate.fuelType]}`}
                . Not counted as spending.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Needs an average mileage from Fuel (two full-tank fill-ups).
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** The trip's costs: add, edit, delete; each says whether it's also in Expenses. */
export function CostsCard({ trip, readOnly }: { trip: Trip; readOnly: boolean }) {
  const { data: costs } = useTripCosts(trip.id);
  const remove = useDeleteTripCost(trip.id);
  const [editing, setEditing] = useState<TripCost | "new" | null>(null);
  const [deleting, setDeleting] = useState<TripCost | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Costs</CardTitle>
        {!readOnly && (
          <CardAction>
            <Button variant="link" className="h-auto p-0" onClick={() => setEditing("new")}>
              <Plus data-icon="inline-start" />
              Add cost
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!costs ? (
          <Skeleton className="h-16 rounded-lg" aria-label="Loading costs" />
        ) : costs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No costs yet. Tolls, parking and other costs also go to your vehicle&apos;s expenses.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {costs.map((cost) => (
              <li key={cost.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {COST_LABELS[cost.category]}
                    {cost.vendor && (
                      <span className="font-normal text-muted-foreground">{cost.vendor}</span>
                    )}
                    <Badge variant={isVehicleCost(cost.category) ? "secondary" : "outline"}>
                      {isVehicleCost(cost.category) ? "In Expenses" : "Trip only"}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(cost.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-2 font-medium tabular-nums">
                    {formatCurrency(cost.amount)}
                  </span>
                  {!readOnly && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${COST_LABELS[cost.category]} ${formatCurrency(cost.amount)}`}
                        onClick={() => setEditing(cost)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${COST_LABELS[cost.category]} ${formatCurrency(cost.amount)}`}
                        onClick={() => setDeleting(cost)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <TripCostDialog
        trip={trip}
        cost={editing && editing !== "new" ? editing : undefined}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete this ${deleting ? COST_LABELS[deleting.category].toLowerCase() : "cost"}?`}
        description={
          deleting && isVehicleCost(deleting.category)
            ? "Its expense is deleted too."
            : "It's removed from this trip."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(deleting!.id);
          setDeleting(null);
        }}
      />
    </Card>
  );
}

/** Fill-ups linked to the trip (its actual fuel); Fuel still owns them. */
export function FuelCard({ trip, readOnly }: { trip: Trip; readOnly: boolean }) {
  const { data: entries } = useTripFuel(trip.id);
  const link = useLinkFuel(trip.id);
  const [linking, setLinking] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuel</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!entries ? (
          <Skeleton className="h-12 rounded-lg" aria-label="Loading fill-ups" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fill-ups linked.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Fuel className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">
                    {[entry.station, formatDateTime(entry.filledAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="mr-2 font-medium tabular-nums">
                    {formatCurrency(entry.totalAmount)}
                  </span>
                  {!readOnly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Unlink fill-up of ${formatCurrency(entry.totalAmount)}`}
                      onClick={() => link.mutate({ fuelEntryId: entry.id, linked: false })}
                    >
                      <Unlink />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div className="flex flex-wrap gap-4">
            <Button variant="link" className="h-auto p-0" onClick={() => setLinking(true)}>
              <Link2 data-icon="inline-start" />
              Link a fill-up
            </Button>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link to={`/fuel/new?vehicle=${trip.vehicleId}`}>
                <Plus data-icon="inline-start" />
                Add fill-up
              </Link>
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          A fill-up counts for this trip only when you link it.
        </p>
      </CardContent>
      <LinkFuelDialog trip={trip} open={linking} onOpenChange={setLinking} />
    </Card>
  );
}

function LinkFuelDialog({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: candidates } = useFuelCandidates(trip.id, open);
  const { data: linked } = useTripFuel(trip.id);
  const link = useLinkFuel(trip.id);
  const free = (candidates ?? []).filter((entry) => !linked?.some((item) => item.id === entry.id));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link a fill-up</DialogTitle>
          <DialogDescription>
            Fill-ups of this vehicle from the day before the trip to the day after it.
          </DialogDescription>
        </DialogHeader>
        {!candidates ? (
          <Skeleton className="h-16 rounded-lg" aria-label="Loading fill-ups" />
        ) : free.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fill-ups around this trip.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {free.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {[entry.station, formatDateTime(entry.filledAt)].filter(Boolean).join(" · ")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(entry.totalAmount)}
                  </span>
                </span>
                <span className="shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      link.mutate(
                        { fuelEntryId: entry.id, linked: true },
                        { onSuccess: () => onOpenChange(false) },
                      )
                    }
                  >
                    Link
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
