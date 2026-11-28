import type { CreateBudgetValues, UpdateBudgetValues } from "@automate/shared";
import { useQuery } from "@tanstack/react-query";

import { useWrite } from "@/features/expenses/hooks/use-recurring";
import { budgetService } from "@/features/expenses/services/budget-service";

/** Under `expenses`: any expense write changes what's been spent. */
export const budgetKeys = {
  all: (vehicleId: string | undefined) => ["expenses", "budgets", vehicleId ?? "all"] as const,
};

export function useBudgets(vehicleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.all(vehicleId),
    queryFn: () => budgetService.all({ vehicleId }),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export const useCreateBudget = () =>
  useWrite((values: CreateBudgetValues) => budgetService.create(values), "Budget set.", {
    form: true,
  });

export const useUpdateBudget = () =>
  useWrite(
    ({ id, values }: { id: string; values: UpdateBudgetValues }) =>
      budgetService.update(id, values),
    "Budget updated.",
    { form: true },
  );

export const useDeleteBudget = () =>
  useWrite((id: string) => budgetService.remove(id), "Budget removed.");
