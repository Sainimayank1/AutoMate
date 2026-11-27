import type { FuelOverview } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MileageChart } from "@/features/fuel/components/mileage-chart";
import { formatCurrency, formatEfficiency, formatNumber, formatVolume } from "@/utils/format";

/**
 * Stitch "Dashboard" fuel & mileage: the full-tank engine's cycles (the Fuel module's own
 * calculation) and the period's fill-ups. Units follow the fuel (km/L, km/kg, km/kWh).
 */
export function FuelSection({ fuel, range }: { fuel: FuelOverview; range: string }) {
  const rows: { label: string; value: string; note?: string }[] = [
    {
      label: "Average mileage",
      value: formatEfficiency(fuel.averageMileage, fuel.mileageUnit),
      note: fuel.cycles
        ? `${formatNumber(fuel.cycles)} full-tank ${fuel.cycles === 1 ? "cycle" : "cycles"}`
        : "No full-tank cycle ended",
    },
    {
      label: "Latest mileage",
      value: formatEfficiency(fuel.latestMileage?.mileage, fuel.mileageUnit),
      note: fuel.latestMileage ? format(parseISO(fuel.latestMileage.date), "d MMM") : undefined,
    },
    { label: "Fuel bought", value: formatVolume(fuel.quantity, fuel.unit) },
    { label: "Fuel spend", value: formatCurrency(fuel.spend) },
    {
      label: "Average price",
      value: fuel.averagePrice ? `${formatCurrency(fuel.averagePrice)}/${fuel.unit}` : "—",
    },
    { label: "Fuel cost per km", value: formatCurrency(fuel.costPerKm) },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader>
          <CardTitle>Mileage</CardTitle>
          <p className="text-sm text-muted-foreground">Full-tank to full-tank cycles</p>
        </CardHeader>
        {/* Taller beside the fuel list on wide screens, so the card has no empty band. */}
        <CardContent className="lg:[&_[data-slot=chart]]:h-64">
          {fuel.trend.length >= 2 ? (
            <MileageChart
              points={fuel.trend}
              unit={fuel.mileageUnit}
              average={fuel.averageMileage}
              // The line is this period's average, drawn across the longer trend: say so.
              averageLabel="Period avg"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              The trend needs two full-tank cycles. Fill to full and log it twice in a row.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>Fuel this period</CardTitle>
          <p className="text-sm text-muted-foreground">{range}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col divide-y">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right">
                  <span className="font-medium tabular-nums">{row.value}</span>
                  {row.note && (
                    <span className="block text-xs text-muted-foreground">{row.note}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <Link to="/fuel" className="text-sm font-medium text-primary hover:underline">
            View fuel history
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
