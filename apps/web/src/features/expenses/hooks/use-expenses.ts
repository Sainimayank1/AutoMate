import type {
  CreateExpenseCategoryValues,
  CreateRefundValues,
  OwnershipQuery,
  UpdateExpenseCategoryValues,
  UpdateExpenseValues,
} from "@automate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import {
  type ExpenseListParams,
  expenseService,
} from "@/features/expenses/services/expense-service";
import { vehicleKeys } from "@/features/garage/hooks/use-vehicles";
import { maintenanceKeys } from "@/features/maintenance/hooks/maintenance-keys";

export const expenseKeys = {
  all: ["expenses"] as const,
  lists: () => ["expenses", "list"] as const,
  list: (params: ExpenseListParams) => ["expenses", "list", params] as const,
  summary: (vehicleId: string | undefined) => ["expenses", "summary", vehicleId ?? "all"] as const,
  trend: (vehicleId: string | undefined) => ["expenses", "trend", vehicleId ?? "all"] as const,
  ownership: (query: OwnershipQuery) => ["expenses", "ownership", query] as const,
  insights: (vehicleId: string) => ["expenses", "insights", vehicleId] as const,
  report: (query: OwnershipQuery) => ["expenses", "report", query] as const,
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

/** The Overview figures; under `expenseKeys.all`, so every expense or fuel write refreshes them. */
export function useExpenseSummary(vehicleId: string | undefined, { enabled = true } = {}) {
  return useQuery({
    queryKey: expenseKeys.summary(vehicleId),
    queryFn: () => expenseService.summary({ vehicleId }),
    enabled,
  });
}

export function useExpenseTrend(vehicleId: string | undefined, { enabled = true } = {}) {
  return useQuery({
    queryKey: expenseKeys.trend(vehicleId),
    queryFn: () => expenseService.trend({ vehicleId }),
    enabled,
  });
}

export function useExpenseInsights(vehicleId: string | undefined) {
  return useQuery({
    queryKey: expenseKeys.insights(vehicleId!),
    queryFn: () => expenseService.insights({ vehicleId: vehicleId! }),
    enabled: !!vehicleId,
  });
}

/** Every expense for some filters at once (the printable report's transactions). */
export function useAllExpenses(params: ExpenseListParams | undefined) {
  return useQuery({
    queryKey: ["expenses", "all-rows", params] as const,
    queryFn: () => expenseService.listAll(params!),
    enabled: !!params,
  });
}

export function useExpenseReport(query: OwnershipQuery | undefined) {
  return useQuery({
    queryKey: expenseKeys.report(query!),
    queryFn: () => expenseService.report(query!),
    enabled: !!query,
    placeholderData: (previous) => previous,
  });
}

/** Checks a CSV; the dialog shows its errors itself. */
export function usePreviewImport() {
  return useMutation({ mutationFn: expenseService.previewImport, onError: () => {} });
}

export function useImportExpenses() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.import,
    onSuccess: async ({ imported }) => {
      await sync();
      toast.success(`${imported} expense${imported === 1 ? "" : "s"} imported.`);
    },
    onError: () => {},
  });
}

export function useOwnershipCost(query: OwnershipQuery | undefined) {
  return useQuery({
    queryKey: expenseKeys.ownership(query!),
    queryFn: () => expenseService.ownership(query!),
    enabled: !!query,
    placeholderData: (previous) => previous,
  });
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
export function useSyncExpenses() {
  const queryClient = useQueryClient();
  return (deletedId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: expenseKeys.all,
        // A deleted expense's open details would refetch into a 404.
        predicate: (query) => !(query.queryKey[1] === "detail" && query.queryKey[2] === deletedId),
      }),
      queryClient.invalidateQueries({ queryKey: expenseKeys.categories }),
      queryClient.invalidateQueries({ queryKey: vehicleKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      // Maintenance spending comes from expenses; readings move due by distance.
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all }),
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
    onSuccess: async (_, id) => {
      await sync(id);
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

const bulkMessage = (done: number, skipped: number, verb: string, why: string) =>
  `${done} ${done === 1 ? "expense" : "expenses"} ${verb}.` +
  (skipped ? ` ${skipped} skipped (${why}).` : "");

export function useBulkDeleteExpenses() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.bulkDelete,
    onSuccess: async ({ affected, skipped }) => {
      await sync();
      toast.success(
        bulkMessage(affected, skipped, "deleted", "from other modules or archived vehicles"),
      );
    },
  });
}

export function useBulkRecategoriseExpenses() {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: expenseService.bulkRecategorise,
    onSuccess: async ({ affected, skipped }) => {
      await sync();
      toast.success(
        bulkMessage(
          affected,
          skipped,
          "moved",
          "loan payments, refunds, or from other modules or archived vehicles",
        ),
      );
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
  // Expenses carry their category's name and icon: refresh them too.
  const sync = useSyncExpenses();
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
