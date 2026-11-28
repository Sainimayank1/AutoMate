import { roadTripSummary, type Trip } from "@automate/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDistance, formatNumber } from "@/utils/format";

/** A done multi-day trip in figures; cost figures only when costs are recorded. */
export function RoadTripSummary({ trip }: { trip: Trip }) {
  const summary = roadTripSummary(trip);
  const tiles = [
    ["Days", formatNumber(summary.days)],
    ["Nights", formatNumber(summary.nights)],
    ["Distance", formatDistance(trip.distanceKm)],
    ["A day", formatDistance(summary.kmPerDay)],
    ["Actual cost", trip.actualCost ? formatCurrency(trip.actualCost) : "No costs yet"],
    ["Cost a day", summary.costPerDay ? formatCurrency(summary.costPerDay) : "—"],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Road trip summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-heading font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
