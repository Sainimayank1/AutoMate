import { type ExpenseInsight, ExpenseInsightKind } from "@automate/shared";
import { cn } from "cn";
import {
  ArrowRight,
  Copy,
  Lightbulb,
  type LucideIcon,
  ReceiptIndianRupee,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";

import { ErrorState } from "@/components/feedback/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useExpenseInsights } from "@/features/expenses/hooks/use-expenses";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

const KIND_ICON: Record<ExpenseInsightKind, LucideIcon> = {
  [ExpenseInsightKind.BUDGET]: Target,
  [ExpenseInsightKind.CATEGORY_ABOVE_USUAL]: TrendingUp,
  [ExpenseInsightKind.POSSIBLE_DUPLICATE]: Copy,
  [ExpenseInsightKind.LARGE_EXPENSE]: ReceiptIndianRupee,
};

/** Amber for money over a limit or the usual, muted for what's worth a look (the dashboard's). */
const TONE: Record<ExpenseInsight["tone"], { tile: string; icon: string; label: string }> = {
  negative: { tile: "border-l-warning", icon: "bg-warning/10 text-warning", label: "Over" },
  neutral: {
    tile: "border-l-muted-foreground/60",
    icon: "bg-muted text-muted-foreground",
    label: "Worth a look",
  },
};

/**
 * `/expenses/insights` (Stitch "Expenses — Insights"): what stands out in one vehicle's expenses,
 * found by the API's fixed rules (never AI, so no Sparkles): budgets past their limit, categories
 * above their usual month, likely duplicates and large one-offs, each with where to look.
 */
export function Component() {
  const filters = useExpenseFilters();
  const garage = useActiveVehicle();
  const vehicleId = filters.query.vehicleId ?? garage.activeVehicle?.id;
  const insights = useExpenseInsights(filters.ready ? vehicleId : undefined);
  const data = insights.data;

  return (
    <ExpensesLayout tab="insights">
      <Select value={vehicleId ?? ""} onValueChange={(value) => filters.set("vehicle", value)}>
        <SelectTrigger aria-label="Vehicle" className="w-full sm:w-64 max-md:h-10">
          <SelectValue placeholder="Choose a vehicle" />
        </SelectTrigger>
        <SelectContent>
          {garage.vehicles.map((vehicle) => (
            <SelectItem key={vehicle.id} value={vehicle.id}>
              {vehicleName(vehicle)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Card>
        <CardHeader className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-insight/10 text-insight">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle role="heading" aria-level={2}>
              What stands out
            </CardTitle>
            <CardDescription>From your own records · rules, not AI</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {insights.isError && !data ? (
            <ErrorState
              title="Couldn't load the insights"
              error={insights.error}
              onRetry={() => void insights.refetch()}
            />
          ) : !data ? (
            <Skeleton className="h-40 w-full" />
          ) : data.items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.items.map((insight) => (
                <li key={insight.id} className="flex">
                  <InsightTile insight={insight} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing stands out: budgets are on track and spending looks like a usual month.
            </p>
          )}
          {data && data.monthsOfHistory < 2 && (
            <p className="text-xs text-muted-foreground">
              Comparisons with your usual month start once two of the last three months have
              expenses.
            </p>
          )}
        </CardContent>
      </Card>
    </ExpensesLayout>
  );
}

function InsightTile({ insight }: { insight: ExpenseInsight }) {
  const tone = TONE[insight.tone];
  const Icon = KIND_ICON[insight.kind];
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-between gap-3 rounded-lg border border-l-2 bg-elevated p-4",
        tone.tile,
      )}
    >
      <div className="flex flex-col gap-2">
        <span className={cn("flex size-7 items-center justify-center rounded-md", tone.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <h3 className="text-sm font-medium text-balance">
          <span className="sr-only">{tone.label}: </span>
          {insight.title}
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">{insight.explanation}</p>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {insight.metric && (
          <p className="text-xs tabular-nums">
            <span className="text-muted-foreground">{insight.metric.label}: </span>
            <span className="font-medium">{insight.metric.value}</span>
            {insight.metric.compared && (
              <span className="text-muted-foreground"> · {insight.metric.compared}</span>
            )}
          </p>
        )}
        <Link
          to={insight.action.href}
          className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline max-md:min-h-10"
        >
          {insight.action.label}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
