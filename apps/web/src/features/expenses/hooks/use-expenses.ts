import type {
  CreateExpenseCategoryValues,
  CreateRefundValues,
  UpdateExpenseCategoryValues,
  UpdateExpenseValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  type ExpenseListParams,
  expenseService,
} from "@/features/expenses/services/expense-service";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";

export const expenseKeys = {
  all: ["expenses"] as const,
  lists: () => ["expenses", "list"] as const,
  list: (params: ExpenseListParams) => ["expenses", "list", params] as const,
  detail: (id: string) => ["expenses", "detail", id] as const,
  categories: ["expense-categories"] as const,
};

/** One page of expenses for the filters; paging keeps the last page on screen until the next arrives. */
export function useExpenses(params: ExpenseListParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => expenseService.list(params),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Every page for the current filters, for the CSV export. */
export function useExportExpenses() {
  return useMutation({ mutationFn: (params: ExpenseListParams) => expenseService.listAll(params) });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.detail(id ?? ""),
    queryFn: () => expenseService.get(id!),
    enabled: !!id,
  });
}

/** The whole category tree, disabled ones included (pickers hide them). */
export function useExpenseCategories() {
  return useQuery({
    queryKey: expenseKeys.categories,
    queryFn: expenseService.categories,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * After any expense write: every list, detail and category count may change, and an odometer
 * reading may have raised a vehicle's.
 */
function useSyncExpenses() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: expenseKeys.all }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
    ]);
}

// Forms show errors inline (applyServerErrors), so these opt out of the global error toast.
const handledByForm = () => {};

export function useCreateExpense() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.create,
    onSuccess: async () => {
      await sync();
      toast.success("Expense saved.");
    },
    onError: handledByForm,
  });
}

export function useUpdateExpense(id: string) {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: (values: UpdateExpenseValues) => expenseService.update(id, values),
    onSuccess: async () => {
      await sync();
      toast.success("Expense updated.");
    },
    onError: handledByForm,
  });
}

export function useDeleteExpense() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.remove,
    onSuccess: async () => {
      await sync();
      toast.success("Expense deleted.");
    },
  });
}

export function useRefundExpense(id: string) {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: (values: CreateRefundValues) => expenseService.refund(id, values),
    onSuccess: async () => {
      await sync();
      toast.success("Refund recorded.");
    },
    onError: handledByForm,
  });
}

const bulkMessage = (done: number, skipped: number, verb: string) =>
  `${done} ${done === 1 ? "expense" : "expenses"} ${verb}.` +
  (skipped ? ` ${skipped} skipped (from other modules or archived vehicles).` : "");

export function useBulkDeleteExpenses() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.bulkDelete,
    onSuccess: async ({ affected, skipped }) => {
      await sync();
      toast.success(bulkMessage(affected, skipped, "deleted"));
    },
  });
}

export function useBulkRecategoriseExpenses() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.bulkRecategorise,
    onSuccess: async ({ affected, skipped }) => {
      await sync();
      toast.success(bulkMessage(affected, skipped, "moved"));
    },
  });
}

function useSyncCategories() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: expenseKeys.categories });
}

export function useCreateExpenseCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: (values: CreateExpenseCategoryValues) => expenseService.createCategory(values),
    onSuccess: async (category) => {
      await sync();
      toast.success(`"${category.name}" added.`);
    },
    onError: handledByForm,
  });
}

export function useUpdateExpenseCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateExpenseCategoryValues }) =>
      expenseService.updateCategory(id, values),
    onSuccess: async () => {
      await sync();
    },
    onError: handledByForm,
  });
}

export function useDeleteExpenseCategory() {
  const sync = useSyncCategories();
  return useMutation({
    mutationFn: expenseService.removeCategory,
    onSuccess: async () => {
      await sync();
      toast.success("Category deleted.");
    },
  });
}
