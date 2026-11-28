import type { TripAnalytics } from "@automate/shared";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LENGTH_BAND_LABELS, WEEKDAY_LABELS } from "@/features/trips/constants";
import { formatDistance } from "@/utils/format";

const config = { trips: { label: "Trips", color: "var(--chart-1)" } } satisfies ChartConfig;

const tooltip = (
  <ChartTooltip
    cursor={false}
    content={
      <ChartTooltipContent
        formatter={(_, __, item) => {
          const row = item.payload as { trips: number; distanceKm: string };
          return (
            <span className="flex w-full justify-between gap-4">
              <span className="text-muted-foreground">
                {row.trips} {row.trips === 1 ? "trip" : "trips"}
              </span>
              <span className="font-mono tabular-nums">{formatDistance(row.distanceKm)}</span>
            </span>
          );
        }}
      />
    }
  />
);

/** Stitch "Trips — Analytics": trips started on each weekday, Monday first. */
export function WeekdayChart({ rows }: { rows: TripAnalytics["time"]["byWeekday"] }) {
  const data = rows.map((row) => ({ ...row, name: WEEKDAY_LABELS[row.weekday - 1] }));
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-52 w-full"
      role="img"
      aria-label={`Trips by weekday: ${data.map((row) => `${row.name} ${row.trips}`).join(", ")}`}
    >
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        {tooltip}
        <Bar dataKey="trips" fill="var(--color-trips)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Stitch "Trips — Analytics": how many trips fall in each length band (local to long distance). */
export function LengthChart({ rows }: { rows: TripAnalytics["distance"]["bands"] }) {
  const data = rows.map((row) => ({ ...row, name: LENGTH_BAND_LABELS[row.band] }));
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-52 w-full"
      role="img"
      aria-label={`Trip lengths: ${data.map((row) => `${row.name} ${row.trips}`).join(", ")}`}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={84} />
        {tooltip}
        <Bar dataKey="trips" fill="var(--color-trips)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
