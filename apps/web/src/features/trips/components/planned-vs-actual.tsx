import type { Trip } from "@automate/shared";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { durationText } from "@/features/trips/utils/trip-text";
import { formatCurrency, formatDistance } from "@/utils/format";

// Hundredths as integers, so money and distance differences are exact.
const hundredths = (value: string) => Math.round(Number(value) * 100);
const signed = (difference: number, text: string) =>
  difference === 0 ? "As planned" : `${difference > 0 ? "+" : "−"}${text}`;

/** A done trip that was planned: what was planned beside what happened. */
export function PlannedVsActual({ trip }: { trip: Trip }) {
  const plan = trip.plan;
  if (!plan) return null;
  const distance = plan.distanceKm && hundredths(trip.distanceKm) - hundredths(plan.distanceKm);
  const duration =
    plan.durationMinutes != null && trip.durationMinutes != null
      ? trip.durationMinutes - plan.durationMinutes
      : null;
  const cost =
    plan.budget && trip.actualCost ? hundredths(trip.actualCost) - hundredths(plan.budget) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Planned vs actual</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Figure
            label="Distance"
            planned={plan.distanceKm ? formatDistance(plan.distanceKm) : "Not planned"}
            actual={formatDistance(trip.distanceKm)}
            difference={
              typeof distance === "number"
                ? signed(distance, formatDistance((Math.abs(distance) / 100).toFixed(1)))
                : null
            }
            over={typeof distance === "number" && distance > 0}
          />
          <Figure
            label="Duration"
            planned={
              plan.durationMinutes != null ? durationText(plan.durationMinutes) : "Not planned"
            }
            actual={
              trip.durationMinutes != null ? durationText(trip.durationMinutes) : "Not recorded"
            }
            difference={
              duration !== null ? signed(duration, durationText(Math.abs(duration))) : null
            }
            over={duration !== null && duration > 0}
          />
          <Figure
            label="Cost"
            planned={plan.budget ? formatCurrency(plan.budget) : "No budget"}
            actual={trip.actualCost ? formatCurrency(trip.actualCost) : "No costs yet"}
            difference={
              cost !== null ? signed(cost, formatCurrency((Math.abs(cost) / 100).toFixed(2))) : null
            }
            over={cost !== null && cost > 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Figure({
  label,
  planned,
  actual,
  difference,
  over,
}: {
  label: string;
  planned: ReactNode;
  actual: ReactNode;
  difference: string | null;
  over: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-heading text-lg font-semibold tabular-nums">{actual}</span>
      <span className="text-xs text-muted-foreground tabular-nums">Planned {planned}</span>
      {difference && (
        <span
          className={`text-xs font-medium tabular-nums ${over ? "text-warning" : "text-success"}`}
        >
          {difference}
        </span>
      )}
    </div>
  );
}
