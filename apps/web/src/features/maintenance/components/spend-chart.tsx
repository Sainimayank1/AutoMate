import type { MaintenanceSpendMonth } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency, formatNumber } from "@/utils/format";

const config = {
  maintenance: { label: "Maintenance", color: "var(--chart-1)" },
  repairs: { label: "Repairs", color: "var(--chart-2)" },
} satisfies ChartConfig;

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM yy");

/**
 * Stitch "Maintenance" spending card: monthly stacked bars, Maintenance vs Repairs, from the API's
 * figures (Expenses). Deviation: chart-1 / chart-2 instead of Stitch's primary / tertiary bars, per
 * color-system.md "Charts".
 */
export function SpendChart({ months }: { months: MaintenanceSpendMonth[] }) {
  // Numbers for plotting only; the tooltip formats the API's strings.
  const data = months.map((month) => ({
    month: month.month,
    maintenance: Number(month.maintenance),
    repairs: Number(month.repairs),
    raw: month,
  }));
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-48 w-full"
      role="img"
      aria-label={`Maintenance and repair spending by month, ${monthLabel(months[0]!.month)} to ${monthLabel(months.at(-1)!.month)}`}
    >
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={12}
          tickFormatter={monthLabel}
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
                const month = (payload[0]?.payload as { month?: string } | undefined)?.month;
                return month ? format(parseISO(`${month}-01`), "MMMM yyyy") : "";
              }}
              formatter={(value, name, item) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config].label}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(
                      (item.payload as (typeof data)[number]).raw[
                        name as "maintenance" | "repairs"
                      ] ?? value,
                    )}
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="maintenance"
          stackId="spend"
          fill="var(--color-maintenance)"
          maxBarSize={32}
        />
        <Bar
          dataKey="repairs"
          stackId="spend"
          fill="var(--color-repairs)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ChartContainer>
  );
}
