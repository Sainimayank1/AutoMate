import { Car } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { emptyExpenseForm, toExpenseForm } from "@/features/expenses/components/expense-form-model";
import {
  useCreateExpense,
  useExpense,
  useExpenseCategories,
} from "@/features/expenses/hooks/use-expenses";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

/**
 * `/expenses/new[?from=<id>]`: add an expense, for the active vehicle by default.
 * `from` duplicates an existing expense (dated today) for review before saving.
 */
export function Component() {
  const { vehicles, activeVehicle, isPending, isError, error, refetch } = useActiveVehicle();
  const [params] = useSearchParams();
  const fromId = params.get("from") ?? undefined;
  const from = useExpense(fromId);
  const categories = useExpenseCategories();
  const create = useCreateExpense();

  if (isPending || categories.isPending || (fromId && from.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (isError || categories.isError) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load the form"
        error={error ?? categories.error}
        onRetry={() => void Promise.all([refetch(), categories.refetch()])}
      />
    );
  }
  if (!activeVehicle) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={Car}
        title="Add a vehicle first"
        description="Expenses are recorded against a vehicle in your garage."
        action={
          <Button asChild>
            <Link to="/garage/new">Add vehicle</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ExpenseForm
      mode="create"
      vehicles={vehicles}
      defaultValues={
        from.data
          ? toExpenseForm(from.data, { duplicate: true })
          : emptyExpenseForm(activeVehicle.id)
      }
      // A client-generated id: a retried save can't create a second expense.
      onSave={(values) => create.mutateAsync({ ...values, id: crypto.randomUUID() })}
    />
  );
}
