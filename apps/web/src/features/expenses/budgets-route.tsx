import { type Budget, BudgetState } from "@automate/shared";
import { cn } from "cn";
import { Plus, Target } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetCard } from "@/features/expenses/components/budget-card";
import { BudgetDialog } from "@/features/expenses/components/budget-dialog";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { budgetTitle } from "@/features/expenses/constants";
import { useBudgets, useDeleteBudget } from "@/features/expenses/hooks/use-budgets";
import { ALL_VEHICLES, useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { useExpenseCategories } from "@/features/expenses/hooks/use-expenses";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";

const SUMMARY = [
  { state: BudgetState.OVER, label: "Over budget", tone: "text-destructive" },
  { state: BudgetState.WARNING, label: "Near the limit", tone: "text-warning" },
  { state: BudgetState.ON_TRACK, label: "On track", tone: "" },
] as const;

/**
 * `/expenses/budgets` (Stitch "Expenses — Budgets"): each budget of the vehicle in scope with what's
 * been spent this month or year, and how many are over, near the limit or on track.
 */
export function Component() {
  const filters = useExpenseFilters();
  const vehicles = useVehicles();
  const categories = useExpenseCategories();
  const vehicleId = filters.query.vehicleId;
  const budgets = useBudgets(vehicleId, filters.ready);
  const remove = useDeleteBudget();
  const [dialog, setDialog] = useState<{ editing?: Budget } | null>(null);
  const [removing, setRemoving] = useState<Budget | null>(null);
  const items = budgets.data ?? [];
  const garage = vehicles.data ?? [];
  const add = (
    <Button onClick={() => setDialog({})} disabled={!garage.length} className="max-md:h-10">
      <Plus data-icon="inline-start" />
      Add budget
    </Button>
  );

  return (
    <ExpensesLayout tab="budgets">
      <Select value={filters.vehicle} onValueChange={(value) => filters.set("vehicle", value)}>
        <SelectTrigger aria-label="Vehicle scope" className="w-full sm:w-64 max-md:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
          {garage.map((vehicle) => (
            <SelectItem key={vehicle.id} value={vehicle.id}>
              {vehicleName(vehicle)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <section
        aria-labelledby="budgets-title"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex flex-col gap-0.5">
          <h2 id="budgets-title" className="font-heading text-xl font-semibold">
            Budgets
          </h2>
          <p className="text-sm text-muted-foreground">
            {vehicleId ? "Limits for this vehicle" : "Limits for each vehicle"} per month or year.
            Spending counts refunds off and loan principal out.
          </p>
        </div>
        <div className="max-sm:w-full max-sm:*:w-full">{add}</div>
      </section>

      {budgets.isError && !budgets.data ? (
        <ErrorState
          title="Couldn't load the budgets"
          error={budgets.error}
          onRetry={() => void budgets.refetch()}
        />
      ) : !budgets.data ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed"
          icon={Target}
          title="No budgets yet"
          description="Set a monthly or yearly limit for the whole vehicle or one category, and see how spending tracks against it."
          action={add}
        />
      ) : (
        <>
          <section aria-label="Budgets by state" className="grid grid-cols-3 gap-3 sm:gap-4">
            {SUMMARY.map((tile) => (
              <div
                key={tile.state}
                className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-3 max-sm:flex-col max-sm:items-start sm:px-4"
              >
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                  {tile.label}
                </span>
                <span className={cn("font-heading text-xl font-semibold tabular-nums", tile.tone)}>
                  {items.filter((budget) => budget.state === tile.state).length}
                </span>
              </div>
            ))}
          </section>
          <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
            {items.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                vehicle={vehicleId ? undefined : garage.find((v) => v.id === budget.vehicleId)}
                onEdit={() => setDialog({ editing: budget })}
                onDelete={() => setRemoving(budget)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Budgets don&apos;t change your expenses. Set one per category, or one for everything.
          </p>
        </>
      )}

      {dialog && (
        <BudgetDialog
          key={dialog.editing?.id ?? "new"}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          vehicles={garage}
          categories={(categories.data ?? []).filter((category) => category.active)}
          vehicleId={vehicleId}
          editing={dialog.editing}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete the ${removing ? budgetTitle(removing) : ""} budget?`}
        description="The limit goes. Your expenses stay as they are."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.id);
          setRemoving(null);
        }}
      />
    </ExpensesLayout>
  );
}
