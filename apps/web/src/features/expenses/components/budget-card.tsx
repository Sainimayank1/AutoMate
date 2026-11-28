import { type Budget, BudgetPeriod, BudgetState, type Vehicle } from "@automate/shared";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { CarFront, EllipsisVertical } from "lucide-react";

import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/features/expenses/components/category-icon";
import { BUDGET_STATE, budgetTitle } from "@/features/expenses/constants";
import { vehicleName } from "@/features/garage/constants";
import { formatCurrency } from "@/utils/format";

/**
 * Stitch "Expenses — Budgets" card: what's been spent of the limit this month or year, a bar with
 * a tick where the warning starts, and what's left (or how far over). Figures come from the API.
 */
export function BudgetCard({
  budget,
  vehicle,
  onEdit,
  onDelete,
}: {
  budget: Budget;
  /** Shown when the scope is all vehicles. */
  vehicle?: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const state = BUDGET_STATE[budget.state];
  const title = budgetTitle(budget);
  const over = budget.state === BudgetState.OVER;
  const period =
    budget.period === BudgetPeriod.YEAR
      ? `${budget.window.from.slice(0, 4)} (yearly)`
      : format(parseISO(budget.window.from), "MMMM yyyy");
  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {budget.category ? (
            <CategoryIcon category={budget.category} />
          ) : (
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground [&>svg]:size-4"
            >
              <CarFront />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle role="heading" aria-level={3} className="sm:truncate">
              {title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-muted-foreground">
                {period}
              </Badge>
              {vehicle && (
                <span className="truncate text-xs text-muted-foreground">
                  {vehicleName(vehicle)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge tone={state.tone} icon={state.icon} label={state.label} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="max-md:size-10"
                aria-label={`Actions for the ${title} budget`}
              >
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2 tabular-nums">
          <p className="font-heading text-lg font-semibold">
            {formatCurrency(budget.spent)}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              of {formatCurrency(budget.amount)}
            </span>
          </p>
          <span className={cn("font-mono text-sm", state.text)}>{budget.percent}%</span>
        </div>
        <div className="relative">
          <Progress
            value={Math.min(budget.percent, 100)}
            aria-label={`${title}: ${budget.percent}% of the limit spent`}
            className={cn("h-2", state.bar)}
          />
          <span
            aria-hidden
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-muted-foreground"
            style={{ left: `${budget.alertPercent}%` }}
          />
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            over ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {over
            ? `Over by ${formatCurrency(budget.remaining.replace("-", ""))}`
            : `${formatCurrency(budget.remaining)} left · warns at ${budget.alertPercent}%`}
        </p>
      </CardContent>
    </Card>
  );
}
