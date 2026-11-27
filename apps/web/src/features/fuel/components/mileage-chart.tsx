import type { MileagePoint } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDate, formatEfficiency, formatNumber } from "@/utils/format";

const config = { mileage: { label: "Mileage", color: "var(--chart-1)" } } satisfies ChartConfig;

/**
 * Mileage per measured full-tank sequence (Stitch "Fuel" trend). Only API-calculated points are
 * drawn, so nothing is interpolated from partial data.
 */
export function MileageChart({
  points,
  unit,
  average,
  averageLabel = "Avg",
}: {
  points: MileagePoint[];
  unit: string;
  /** A dashed reference line (the API's average), labelled "Avg 16.8 km/L". */
  average?: string | null;
  averageLabel?: string;
}) {
  // React ids contain characters that break `url(#…)`.
  const fillId = `mileage-fill-${useId().replace(/[^\w-]/g, "")}`;
  // Numbers for plotting only; labels format the API's strings.
  const data = points.map((point) => ({ date: point.date, mileage: Number(point.mileage) }));
  const first = points[0];
  const last = points.at(-1);

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-48 w-full"
      role="img"
      aria-label={
        first && last
          ? `Mileage over the last ${points.length} full tanks, from ${formatEfficiency(first.mileage, unit)} on ${formatDate(first.date)} to ${formatEfficiency(last.mileage, unit)} on ${formatDate(last.date)}`
          : "Mileage trend"
      }
    >
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-mileage)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-mileage)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => format(parseISO(value), "dd MMM")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
          tickFormatter={(value: number) => formatNumber(value, { maxFractionDigits: 1 })}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                formatDate((payload[0]?.payload as { date?: string } | undefined)?.date)
              }
              formatter={(value) => (
                <span className="font-mono tabular-nums">
                  {formatEfficiency(value as number, unit)}
                </span>
              )}
            />
          }
        />
        {average && (
          <ReferenceLine
            y={Number(average)}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: `${averageLabel} ${formatEfficiency(average, unit)}`,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
        )}
        <Area
          dataKey="mileage"
          type="monotone"
          stroke="var(--color-mileage)"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={{ r: 3, fill: "var(--card)" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
