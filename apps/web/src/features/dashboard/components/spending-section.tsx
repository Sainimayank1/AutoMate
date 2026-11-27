import { type PeriodWindow, SpendGroup, type SpendingOverview } from "@automate/shared";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/features/expenses/components/category-icon";
import { categoryTone } from "@/features/expenses/constants";
import { formatCurrency, formatDateRange, formatNumber } from "@/utils/format";

/** The five fixed series (shared `SpendGroup`), in the expense colours. */
const SERIES = {
  [SpendGroup.FUEL]: { label: "Fuel", color: "var(--chart-1)" },
  [SpendGroup.MAINTENANCE]: { label: "Maintenance & repairs", color: "var(--chart-2)" },
  [SpendGroup.INSURANCE]: { label: "Insurance & legal", color: "var(--chart-3)" },
  [SpendGroup.LOAN]: { label: "Loan interest & charges", color: "var(--chart-4)" },
  [SpendGroup.OTHER]: { label: "Everything else", color: "var(--chart-5)" },
} satisfies ChartConfig;

const monthLabel = (month: string) => format(parseISO(`${month}-01`), "MMM");

/**
 * Stitch "Dashboard" spending: the months around the period by chart group, and where the
 * period's money went by category (each opening its transactions). Net of refunds, loan principal
 * excluded, like "Spent".
 */
export function SpendingSection({
  spending,
  period,
  vehicleId,
}: {
  spending: SpendingOverview;
  period: PeriodWindow;
  vehicleId: string;
}) {
  const range = formatDateRange(period);
  // Only the series that have money in them, so the legend stays honest.
  const shown = Object.values(SpendGroup).filter((group) =>
    spending.months.some((month) => Number(month.groups[group]) !== 0),
  );
  // Numbers for plotting only; labels format the API's strings.
  const data = spending.months.map((month) => ({
    month: month.month,
    ...Object.fromEntries(shown.map((group) => [group, Math.max(Number(month.groups[group]), 0)])),
  }));
  const first = spending.months[0];
  const last = spending.months.at(-1);
  const transactions = (categoryId: string) =>
    `/expenses/transactions?${new URLSearchParams({
      vehicle: vehicleId,
      category: categoryId,
      from: period.from,
      to: period.to,
    }).toString()}`;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-8">
        <CardHeader className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={2}>
              Monthly spending
            </CardTitle>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatCurrency(spending.total)} in {range} · loan principal not included
            </p>
          </div>
          <Link
            to="/expenses"
            className="text-sm font-medium text-primary hover:underline max-md:inline-flex max-md:min-h-10 max-md:items-center"
          >
            View expenses
          </Link>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing spent from {first && monthLabel(first.month)} to{" "}
              {last && monthLabel(last.month)}.
            </p>
          ) : (
            <ChartContainer
              config={SERIES}
              className="aspect-auto h-56 w-full"
              role="img"
              aria-label={`Spending per month from ${first && format(parseISO(`${first.month}-01`), "MMMM yyyy")} to ${last && format(parseISO(`${last.month}-01`), "MMMM yyyy")}: ${spending.months
                .map((month) => `${monthLabel(month.month)} ${formatCurrency(month.total)}`)
                .join(", ")}`}
            >
              <BarChart data={data} margin={{ top: 8, right: 4, left: 4 }}>
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
                        const month = (payload[0]?.payload as { month?: string } | undefined)
                          ?.month;
                        return month ? format(parseISO(`${month}-01`), "MMMM yyyy") : null;
                      }}
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {SERIES[name as SpendGroup].label}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(value as number)}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                {/* Stitch: the legend on top, in stack order (Recharts sorts by name otherwise). */}
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
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Where it went · {range}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {spending.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing spent in {range}.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {spending.categories.map((item) => {
                const percent = formatNumber(item.percent, { maxFractionDigits: 0 });
                return (
                  <li key={item.category.id}>
                    <Link
                      to={transactions(item.category.id)}
                      className="flex flex-col gap-1.5 rounded-lg p-2 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center gap-2.5 text-sm">
                        <CategoryIcon category={item.category} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.category.name}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(item.amount)}{" "}
                          <span className="text-muted-foreground">({percent}%)</span>
                        </span>
                      </span>
                      <Progress
                        value={item.percent}
                        aria-label={`${item.category.name}, ${percent}% of the spending`}
                        className={cn(
                          "h-1.5 [&>[data-slot=progress-indicator]]:bg-current",
                          categoryTone(item.category),
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
