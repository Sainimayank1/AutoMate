import type {
  Budget,
  BudgetListQuery,
  CreateBudgetValues,
  UpdateBudgetValues,
} from "@automate/shared";

import { request, requestAllPages } from "@/lib/api-client";

/** Budgets (Expenses phase 5): spending against each limit comes worked out from the API. */
export const budgetService = {
  /** A handful per vehicle (one per category at most): read whole for the summary counts. */
  all: (params: Pick<BudgetListQuery, "vehicleId">) =>
    requestAllPages<Budget>({ url: "/expense-budgets", params }),
  create: (values: CreateBudgetValues) =>
    request<Budget>({ method: "POST", url: "/expense-budgets", data: values }),
  update: (id: string, values: UpdateBudgetValues) =>
    request<Budget>({ method: "PATCH", url: `/expense-budgets/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/expense-budgets/${id}` }),
};
