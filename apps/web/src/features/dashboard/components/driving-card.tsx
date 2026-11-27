import type { DrivingOverview } from "@automate/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRange, formatDistance, formatNumber } from "@/utils/format";

/** "24 Nov" (the year only when it isn't this one), as in Stitch. */
const shortDate = (date: string) => formatDateRange({ from: date, to: date });

/**
 * Stitch "Dashboard" driving: distance from odometer readings (never from trips, which aren't
 * tracked yet, and never assumed when readings are missing).
 */
export function DrivingCard({ driving, range }: { driving: DrivingOverview; range: string }) {
  const rows = [
    {
      label: "Per day",
      value: driving.perDay ? `~${formatDistance(driving.perDay)}` : "—",
    },
    { label: "Readings", value: formatNumber(driving.readings) },
    {
      label: "Last reading",
      value: driving.lastReading
        ? `${formatDistance(driving.lastReading.km)} on ${shortDate(driving.lastReading.date)}`
        : "—",
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Driving</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {driving.distanceKm === null ? "—" : formatDistance(driving.distanceKm)}
            <span className="text-sm font-normal text-muted-foreground"> in {range}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {driving.distanceKm === null
              ? "Needs two odometer readings in the period"
              : "From odometer readings"}
          </p>
        </div>
        <dl className="flex flex-col divide-y">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-auto text-xs text-muted-foreground">Trips aren&apos;t tracked yet.</p>
      </CardContent>
    </Card>
  );
}
