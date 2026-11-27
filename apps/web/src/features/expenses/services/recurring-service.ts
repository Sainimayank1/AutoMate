import type {
  CreateRecurringExpenseValues,
  CreateVehicleLoanValues,
  LoanRateChangeValues,
  LoanScheduleRow,
  PayRecurringValues,
  RecurringExpense,
  RecurringListQuery,
  RecurringPayment,
  RecurringPaymentsQuery,
  UpdateRecurringExpenseValues,
  UpdateVehicleLoanValues,
  VehicleLoan,
  VehicleLoanListQuery,
} from "@automate/shared";

import { request, requestAllPages, requestPage } from "@/lib/api-client";

/** Recurring payments and vehicle loans (Expenses phase 4). Paying records an expense, once. */
export const recurringService = {
  list: (params: Partial<RecurringListQuery>) =>
    requestPage<RecurringExpense>({ url: "/recurring-expenses", params }),
  get: (id: string) => request<RecurringExpense>({ url: `/recurring-expenses/${id}` }),
  create: (values: CreateRecurringExpenseValues) =>
    request<RecurringExpense>({ method: "POST", url: "/recurring-expenses", data: values }),
  update: (id: string, values: UpdateRecurringExpenseValues) =>
    request<RecurringExpense>({ method: "PATCH", url: `/recurring-expenses/${id}`, data: values }),
  remove: (id: string) => request<void>({ method: "DELETE", url: `/recurring-expenses/${id}` }),
  setStatus: (id: string, action: "pause" | "resume" | "cancel") =>
    request<RecurringExpense>({ method: "POST", url: `/recurring-expenses/${id}/${action}` }),

  payments: (params: Partial<RecurringPaymentsQuery>) =>
    requestPage<RecurringPayment>({ url: "/recurring-expenses/payments", params }),
  pay: (id: string, dueDate: string, values: PayRecurringValues) =>
    request<RecurringPayment>({
      method: "POST",
      url: `/recurring-expenses/${id}/payments/${dueDate}/pay`,
      data: values,
    }),
  skip: (id: string, dueDate: string) =>
    request<RecurringPayment>({
      method: "POST",
      url: `/recurring-expenses/${id}/payments/${dueDate}/skip`,
    }),
  postpone: (id: string, dueDate: string, to: string) =>
    request<RecurringPayment>({
      method: "POST",
      url: `/recurring-expenses/${id}/payments/${dueDate}/postpone`,
      data: { to },
    }),
  reset: (id: string, dueDate: string) =>
    request<RecurringPayment>({
      method: "DELETE",
      url: `/recurring-expenses/${id}/payments/${dueDate}`,
    }),

  loans: (params: Partial<VehicleLoanListQuery>) =>
    requestPage<VehicleLoan>({ url: "/vehicle-loans", params }),
  /** Every loan of a vehicle (a short list): the expense form's loan picker. */
  allLoans: (vehicleId: string) =>
    requestAllPages<VehicleLoan>({ url: "/vehicle-loans", params: { vehicleId } }),
  loan: (id: string) => request<VehicleLoan>({ url: `/vehicle-loans/${id}` }),
  schedule: (id: string, page: number, pageSize: number) =>
    requestPage<LoanScheduleRow>({
      url: `/vehicle-loans/${id}/schedule`,
      params: { page, pageSize },
    }),
  createLoan: (values: CreateVehicleLoanValues) =>
    request<VehicleLoan>({ method: "POST", url: "/vehicle-loans", data: values }),
  updateLoan: (id: string, values: UpdateVehicleLoanValues) =>
    request<VehicleLoan>({ method: "PATCH", url: `/vehicle-loans/${id}`, data: values }),
  removeLoan: (id: string) => request<void>({ method: "DELETE", url: `/vehicle-loans/${id}` }),
  addRateChange: (id: string, values: LoanRateChangeValues) =>
    request<VehicleLoan>({
      method: "POST",
      url: `/vehicle-loans/${id}/rate-changes`,
      data: values,
    }),
  removeRateChange: (id: string, changeId: string) =>
    request<VehicleLoan>({
      method: "DELETE",
      url: `/vehicle-loans/${id}/rate-changes/${changeId}`,
    }),
};
