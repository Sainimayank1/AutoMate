import type {
  CreateRecurringExpenseValues,
  CreateVehicleLoanValues,
  LoanRateChangeValues,
  PayRecurringValues,
  RecurringListQuery,
  RecurringPaymentsQuery,
  UpdateRecurringExpenseValues,
  UpdateVehicleLoanValues,
  VehicleLoanListQuery,
} from "@automate/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSyncExpenses } from "@/features/expenses/hooks/use-expenses";
import { recurringService } from "@/features/expenses/services/recurring-service";

/** Under `expenses`, so any expense write (e.g. deleting a payment's expense) refreshes them. */
export const recurringKeys = {
  list: (params: Partial<RecurringListQuery>) => ["expenses", "recurring", params] as const,
  payments: (params: Partial<RecurringPaymentsQuery>) => ["expenses", "payments", params] as const,
  loans: (params: Partial<VehicleLoanListQuery>) => ["expenses", "loans", params] as const,
  vehicleLoans: (vehicleId: string) => ["expenses", "loans", "all", vehicleId] as const,
  loan: (id: string) => ["expenses", "loan", id] as const,
  schedule: (id: string, page: number) => ["expenses", "loan-schedule", id, page] as const,
};

const keep = <T>(previous: T | undefined) => previous;
// Forms show errors inline, so these opt out of the global error toast.
const handledByForm = () => {};

export function useRecurringList(params: Partial<RecurringListQuery>) {
  return useQuery({
    queryKey: recurringKeys.list(params),
    queryFn: () => recurringService.list(params),
    placeholderData: keep,
  });
}

export function useRecurringPayments(params: Partial<RecurringPaymentsQuery>, enabled = true) {
  return useQuery({
    queryKey: recurringKeys.payments(params),
    queryFn: () => recurringService.payments(params),
    placeholderData: keep,
    enabled,
  });
}

export function useLoans(params: Partial<VehicleLoanListQuery>) {
  return useQuery({
    queryKey: recurringKeys.loans(params),
    queryFn: () => recurringService.loans(params),
    placeholderData: keep,
  });
}

/** A vehicle's loans for the expense form's picker (Finance only). */
export function useVehicleLoans(vehicleId: string | undefined) {
  return useQuery({
    queryKey: recurringKeys.vehicleLoans(vehicleId ?? ""),
    queryFn: () => recurringService.allLoans(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: recurringKeys.loan(id ?? ""),
    queryFn: () => recurringService.loan(id!),
    enabled: !!id,
  });
}

export function useLoanSchedule(id: string, page: number, pageSize = 12) {
  return useQuery({
    queryKey: recurringKeys.schedule(id, page),
    queryFn: () => recurringService.schedule(id, page, pageSize),
    placeholderData: keep,
  });
}

/** Every write here can record or remove money: refresh expenses, vehicles and the dashboard. */
function useWrite<TArgs, TResult>(
  run: (args: TArgs) => Promise<TResult>,
  success: string | ((result: TResult) => string),
  { form = false } = {},
) {
  const sync = useSyncExpenses();
  return useMutation({
    mutationFn: run,
    onSuccess: async (result) => {
      await sync();
      toast.success(typeof success === "string" ? success : success(result));
    },
    ...(form ? { onError: handledByForm } : {}),
  });
}

export const useCreateRecurring = () =>
  useWrite(
    (values: CreateRecurringExpenseValues) => recurringService.create(values),
    "Recurring payment added.",
    { form: true },
  );

export const useUpdateRecurring = (id: string) =>
  useWrite(
    (values: UpdateRecurringExpenseValues) => recurringService.update(id, values),
    "Recurring payment updated.",
    { form: true },
  );

const STATUS_DONE = { pause: "Paused.", resume: "Resumed.", cancel: "Cancelled." } as const;
export const useSetRecurringStatus = () =>
  useWrite(
    ({ id, action }: { id: string; action: keyof typeof STATUS_DONE }) =>
      recurringService.setStatus(id, action).then(() => action),
    (action) => STATUS_DONE[action],
  );

export const useDeleteRecurring = () =>
  useWrite((id: string) => recurringService.remove(id), "Recurring payment deleted.");

export const usePayRecurring = () =>
  useWrite(
    ({ id, dueDate, values }: { id: string; dueDate: string; values: PayRecurringValues }) =>
      recurringService.pay(id, dueDate, values),
    "Payment recorded as an expense.",
    { form: true },
  );

export const useSkipPayment = () =>
  useWrite(
    ({ id, dueDate }: { id: string; dueDate: string }) => recurringService.skip(id, dueDate),
    "Skipped.",
  );

export const usePostponePayment = () =>
  useWrite(
    ({ id, dueDate, to }: { id: string; dueDate: string; to: string }) =>
      recurringService.postpone(id, dueDate, to),
    "Postponed.",
    { form: true },
  );

export const useResetPayment = () =>
  useWrite(
    ({ id, dueDate }: { id: string; dueDate: string }) => recurringService.reset(id, dueDate),
    "Back on schedule.",
  );

export const useCreateLoan = () =>
  useWrite(
    (values: CreateVehicleLoanValues) => recurringService.createLoan(values),
    "Loan added. Its EMIs are on the schedule.",
    { form: true },
  );

export const useUpdateLoan = (id: string) =>
  useWrite(
    (values: UpdateVehicleLoanValues) => recurringService.updateLoan(id, values),
    "Loan updated.",
    { form: true },
  );

export const useDeleteLoan = () =>
  useWrite((id: string) => recurringService.removeLoan(id), "Loan deleted.");

export const useAddRateChange = (id: string) =>
  useWrite(
    (values: LoanRateChangeValues) => recurringService.addRateChange(id, values),
    "Rate change recorded.",
    { form: true },
  );

export const useRemoveRateChange = (id: string) =>
  useWrite(
    (changeId: string) => recurringService.removeRateChange(id, changeId),
    "Rate change removed.",
  );

export function useRecurringSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ["expenses", "recurring", "one", id ?? ""] as const,
    queryFn: () => recurringService.get(id!),
    enabled: !!id,
  });
}
