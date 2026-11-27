import type { TripOverview } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDistance, formatNumber } from "@/utils/format";

const config = { distance: { label: "Distance", color: "var(--chart-1)" } } satisfies ChartConfig;

type Series = TripOverview["series"];
const tick = (start: string, granularity: Series["granularity"]) =>
  format(parseISO(start), granularity === "month" ? "MMM yy" : "d MMM");
const label = (start: string, granularity: Series["granularity"]) =>
  granularity === "month"
    ? format(parseISO(start), "MMMM yyyy")
    : granularity === "week"
      ? `Week of ${format(parseISO(start), "d MMM yyyy")}`
      : format(parseISO(start), "EEE d MMM yyyy");

/** Stitch "Trips Overview" distance card: km per day, week or month, from the API's buckets. */
export function DistanceChart({ series }: { series: Series }) {
  // Numbers for plotting only; the tooltip shows the API's figures.
  const data = series.points.map((point) => ({ ...point, distance: Number(point.distanceKm) }));
  const first = series.points[0]!.start;
  const last = series.points.at(-1)!.start;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-56 w-full"
      role="img"
      aria-label={`Distance driven by ${series.granularity}, ${tick(first, series.granularity)} to ${tick(last, series.granularity)}`}
    >
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="start"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
          tickFormatter={(start: string) => tick(start, series.granularity)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => formatNumber(value, { maxFractionDigits: 0 })}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const start = (payload[0]?.payload as { start?: string } | undefined)?.start;
                return start ? label(start, series.granularity) : "";
              }}
              formatter={(_, __, item) => {
                const point = item.payload as (typeof data)[number];
                return (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-muted-foreground">
                      {point.trips} {point.trips === 1 ? "trip" : "trips"}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatDistance(point.distanceKm)}
                    </span>
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="distance" fill="var(--color-distance)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
