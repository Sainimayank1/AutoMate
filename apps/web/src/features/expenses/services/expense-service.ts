import type {
  BulkResult,
  CreateExpenseCategoryValues,
  CreateExpenseValues,
  CreateRefundValues,
  Expense,
  ExpenseCategory,
  ExpenseDetail,
  ExpenseImportPreview,
  ExpenseImportResult,
  ExpenseImportValues,
  ExpenseInsights,
  ExpenseInsightsQuery,
  ExpenseListQuery,
  ExpenseReport,
  ExpenseSummary,
  ExpenseSummaryQuery,
  ExpenseTrend,
  OwnershipCost,
  OwnershipQuery,
  UpdateExpenseCategoryValues,
  UpdateExpenseValues,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

/** List filters; the API defaults the rest (page 1, newest first, every vehicle). */
export type ExpenseListParams = Partial<ExpenseListQuery>;

/** Expense endpoints. Every call is scoped to the signed-in user by the API. */
export const expenseService = {
  list: (params: ExpenseListParams) => requestPage<Expense>({ url: "/expenses", params }),
  /** Every page for the current filters (CSV export). */
  listAll: (params: ExpenseListParams) => requestAllPages<Expense>({ url: "/expenses", params }),
  /** This month's and year's figures for the Overview (one vehicle, or all when omitted). */
  summary: (params: ExpenseSummaryQuery) =>
    request<ExpenseSummary>({ url: "/expenses/summary", params }),
  /** The last 12 months by chart group, beside the same months a year earlier. */
  trend: (params: ExpenseSummaryQuery) => request<ExpenseTrend>({ url: "/expenses/trend", params }),
  /** Operating, cash outflow and economic ownership cost of one vehicle over a period. */
  /** Budgets past their limit, categories above their usual, duplicates and large one-offs. */
  insights: (params: ExpenseInsightsQuery) =>
    request<ExpenseInsights>({ url: "/expenses/insights", params }),
  /** A CSV checked row by row: counts and the rows that need a look. Nothing is saved. */
  previewImport: (values: ExpenseImportValues) =>
    request<ExpenseImportPreview>({
      method: "POST",
      url: "/expenses/import/preview",
      data: values,
    }),
  import: (values: ExpenseImportValues) =>
    request<ExpenseImportResult>({ method: "POST", url: "/expenses/import", data: values }),
  /** The printable report's figures; its transactions come from `list`. */
  report: (params: OwnershipQuery) => request<ExpenseReport>({ url: "/expenses/report", params }),
  ownership: (params: OwnershipQuery) =>
    request<OwnershipCost>({ url: "/expenses/ownership", params }),
  get: (id: string) => request<ExpenseDetail>({ url: `/expenses/${id}` }),
  create: (values: CreateExpenseValues) =>
    request<ExpenseDetail>({ method: "POST", url: "/expenses", data: values }),
  update: (id: string, values: UpdateExpenseValues) =>
    request<ExpenseDetail>({ method: "PATCH", url: `/expenses/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/expenses/${id}` }),
  refund: (id: string, values: CreateRefundValues) =>
    request<ExpenseDetail>({ method: "POST", url: `/expenses/${id}/refunds`, data: values }),
  bulkDelete: (ids: string[]) =>
    request<BulkResult>({ method: "POST", url: "/expenses/bulk/delete", data: { ids } }),
  bulkRecategorise: (data: { ids: string[]; categoryId: string; subcategoryId: string | null }) =>
    request<BulkResult>({ method: "POST", url: "/expenses/bulk/category", data }),

  /** Every category (all pages): pickers and the categories tab need the whole tree. */
  categories: () =>
    requestAllPages<ExpenseCategory>({
      url: "/expense-categories",
      params: { includeInactive: true },
    }),
  createCategory: (values: CreateExpenseCategoryValues) =>
    request<ExpenseCategory>({ method: "POST", url: "/expense-categories", data: values }),
  updateCategory: (id: string, values: UpdateExpenseCategoryValues) =>
    request<ExpenseCategory>({ method: "PATCH", url: `/expense-categories/${id}`, data: values }),
  removeCategory: (id: string) =>
    request<void>({ method: "DELETE", url: `/expense-categories/${id}` }),
};
