import { SpendGroup } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { ErrorState } from "@/components/feedback/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { SPEND_GROUP_SERIES } from "@/features/expenses/constants";
import { useExpenseTrend } from "@/features/expenses/hooks/use-expenses";
import { formatCurrency, formatNumber } from "@/utils/format";

const CONFIG = {
  ...SPEND_GROUP_SERIES,
  lastYear: { label: "Same month last year", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM");

/**
 * Stitch "Expenses" monthly spending: the last 12 months by chart group (net, loan principal
 * left out), with the same months a year earlier as a dashed line where records cover them.
 */
export function MonthlyTrend({
  vehicleId,
  ready,
}: {
  vehicleId: string | undefined;
  ready: boolean;
}) {
  const trend = useExpenseTrend(vehicleId, { enabled: ready });
  const data = trend.data;
  const shown = Object.values(SpendGroup).filter((group) =>
    data?.months.some((month) => Number(month.groups[group]) !== 0),
  );
  // Numbers for plotting only; labels format the API's strings.
  const points = data?.months.map((month) => ({
    month: month.month,
    ...Object.fromEntries(shown.map((group) => [group, Math.max(Number(month.groups[group]), 0)])),
    lastYear: month.lastYear === null ? null : Number(month.lastYear),
  }));
  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <CardTitle role="heading" aria-level={2}>
          Monthly spending
        </CardTitle>
        {data && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(data.total)} in the last 12 months
            {data.previousTotal !== null &&
              ` · ${formatCurrency(data.previousTotal)} the 12 months before`}{" "}
            · loan principal not included
          </p>
        )}
      </CardHeader>
      <CardContent>
        {trend.isError && !data ? (
          <ErrorState
            title="Couldn't load the trend"
            error={trend.error}
            onRetry={() => void trend.refetch()}
          />
        ) : !data || !points ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ChartContainer
            config={CONFIG}
            className="aspect-auto h-56 w-full"
            role="img"
            aria-label={`Spending per month: ${data.months
              .map((month) => `${monthLabel(month.month)} ${formatCurrency(month.total)}`)
              .join(", ")}`}
          >
            <ComposedChart data={points} margin={{ top: 8, right: 4, left: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={monthLabel}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value: number) => `₹${formatNumber(value)}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const month = (payload[0]?.payload as { month?: string } | undefined)?.month;
                      return month ? format(parseISO(`${month}-01`), "MMMM yyyy") : null;
                    }}
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {CONFIG[name as keyof typeof CONFIG].label}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(value as number)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend
                verticalAlign="top"
                itemSorter={null}
                content={
                  <ChartLegendContent className="flex-wrap gap-x-4 gap-y-1 pt-0 pb-3 [&>div]:whitespace-nowrap" />
                }
              />
              {shown.map((group, index) => (
                <Bar
                  key={group}
                  dataKey={group}
                  stackId="spending"
                  fill={`var(--color-${group})`}
                  radius={index === shown.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
              {data.months.some((month) => month.lastYear !== null) && (
                <Line
                  dataKey="lastYear"
                  type="monotone"
                  stroke="var(--color-lastYear)"
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
