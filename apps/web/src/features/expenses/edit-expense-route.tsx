import { ExpenseKind } from "@automate/shared";
import { ReceiptIndianRupee } from "lucide-react";
import { Link, useParams } from "react-router";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { toExpenseForm } from "@/features/expenses/components/expense-form-model";
import {
  useExpense,
  useExpenseCategories,
  useUpdateExpense,
} from "@/features/expenses/hooks/use-expenses";
import { sourceHref } from "@/features/expenses/utils/expense-helpers";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";

/** `/expenses/:expenseId/edit`: the add form, filled in. Linked expenses are edited at their source. */
export function Component() {
  const { expenseId = "" } = useParams();
  const expense = useExpense(expenseId);
  const vehicles = useVehicles();
  const categories = useExpenseCategories();
  const update = useUpdateExpense(expenseId);

  if (expense.isPending || vehicles.isPending || categories.isPending) {
    return <LoadingState fullScreen label="Loading expense…" />;
  }
  if (!expense.data || !vehicles.data || !categories.data) {
    const error = expense.error ?? vehicles.error ?? categories.error;
    return error?.status === 404 || error?.status === 400 ? (
      <EmptyState
        className="min-h-svh"
        icon={ReceiptIndianRupee}
        title="Expense not found"
        description="It may have been deleted, or it isn't yours."
        action={
          <Button asChild>
            <Link to="/expenses/transactions">Back to expenses</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load this expense"
        error={error}
        onRetry={() =>
          void Promise.all([expense.refetch(), vehicles.refetch(), categories.refetch()])
        }
      />
    );
  }
  if (expense.data.kind === ExpenseKind.REFUND) {
    return (
      <EmptyState
        className="min-h-svh"
        icon={ReceiptIndianRupee}
        title="Refunds can't be edited"
        description="Delete the refund and record it again on its expense."
        action={
          <Button asChild>
            <Link to={`/expenses/transactions/${expense.data.refundOfId}`}>Open its expense</Link>
          </Button>
        }
      />
    );
  }
  if (!expense.data.editable) {
    const origin = sourceHref(expense.data);
    return (
      <EmptyState
        className="min-h-svh"
        icon={ReceiptIndianRupee}
        title="Edit this in its own module"
        description="It comes from another module, which owns the record. Changes made there update the expense."
        action={
          <Button asChild>
            <Link to={origin ?? "/expenses/transactions"}>
              {origin ? "Edit in Fuel" : "Back to expenses"}
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <ExpenseForm
      key={expense.data.id}
      mode="edit"
      vehicles={vehicles.data}
      defaultValues={toExpenseForm(expense.data)}
      onSave={(values) => update.mutateAsync(values)}
    />
  );
}
