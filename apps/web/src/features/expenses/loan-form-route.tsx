import {
  createVehicleLoanSchema,
  type CreateVehicleLoanValues,
  LoanMethod,
  PaymentMethod,
  type RecurringExpense,
  type Vehicle,
  type VehicleLoan,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { type Control, type Resolver, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, TaskFormLayout } from "@/features/expenses/components/task-form-layout";
import { LOAN_METHOD_LABELS } from "@/features/expenses/constants";
import {
  useCreateLoan,
  useLoan,
  useRecurringSchedule,
  useUpdateLoan,
} from "@/features/expenses/hooks/use-recurring";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { usePreferences } from "@/features/settings/hooks/use-settings";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatNumber } from "@/utils/format";

type LoanForm = {
  vehicleId: string;
  lender: string;
  accountNumber: string;
  principal: string;
  annualRate: string;
  tenureMonths: string;
  firstEmiDate: string;
  method: LoanMethod;
  processingFee: string;
  paymentMethod: PaymentMethod | "";
  reminderDays: string;
};

const trim = (value: string | null | undefined) => value?.replace(/\.00$/, "") ?? "";

const toForm = (
  vehicleId: string,
  loan?: VehicleLoan,
  emis?: RecurringExpense,
  reminderDays = 3,
): LoanForm => ({
  vehicleId: loan?.vehicleId ?? vehicleId,
  lender: loan?.lender ?? "",
  accountNumber: loan?.accountNumber ?? "",
  principal: trim(loan?.principal),
  // The loan's own rate (rate changes are kept apart).
  annualRate: loan ? trim(loan.rateChanges.length ? "" : loan.annualRate) : "",
  tenureMonths: loan ? String(loan.tenureMonths) : "",
  firstEmiDate: loan?.firstEmiDate ?? "",
  method: loan?.method ?? LoanMethod.REDUCING,
  processingFee: trim(loan?.processingFee),
  paymentMethod: emis?.paymentMethod ?? "",
  reminderDays: String(emis?.reminderDays ?? reminderDays),
});

/**
 * `/expenses/loans/new` and `/expenses/loans/:id/edit` (Stitch "Add Loan"): the terms; the EMI
 * and the schedule are worked out by the API when it's saved.
 */
export function Component() {
  const { loanId } = useParams();
  const garage = useActiveVehicle();
  const preferences = usePreferences();
  const loan = useLoan(loanId);
  const emis = useRecurringSchedule(loan.data?.recurringId ?? undefined);

  if (
    garage.isPending ||
    (loanId && (loan.isPending || (loan.data?.recurringId && emis.isPending)))
  ) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (garage.isError || loan.isError) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load the form"
        error={garage.error ?? loan.error}
        onRetry={() => void Promise.all([garage.refetch(), loan.refetch()])}
      />
    );
  }
  return (
    <LoanFormPage
      vehicles={garage.vehicles}
      defaults={toForm(
        garage.activeVehicle?.id ?? "",
        loan.data,
        emis.data,
        preferences.data?.reminderTiming.paymentDays,
      )}
      loan={loan.data}
    />
  );
}

function LoanFormPage({
  vehicles,
  defaults,
  loan,
}: {
  vehicles: Vehicle[];
  defaults: LoanForm;
  loan?: VehicleLoan;
}) {
  const navigate = useNavigate();
  const create = useCreateLoan();
  const update = useUpdateLoan(loan?.id ?? "");
  const form = useForm<LoanForm, unknown, CreateVehicleLoanValues>({
    resolver: zodResolver(createVehicleLoanSchema) as unknown as Resolver<
      LoanForm,
      unknown,
      CreateVehicleLoanValues
    >,
    defaultValues: defaults,
    mode: "onTouched",
  });
  const control = form.control as unknown as Control<LoanForm>;
  const { isDirty, isSubmitting, errors } = form.formState;
  const values = useWatch({ control });
  const rateLocked = !!loan?.rateChanges.length;

  const submit = form.handleSubmit(async (output) => {
    try {
      const saved = loan
        ? await update.mutateAsync(
            (({ vehicleId: _vehicle, ...changes }) => changes)(
              rateLocked ? { ...output, annualRate: undefined } : output,
            ),
          )
        : await create.mutateAsync(output);
      navigate(`/expenses/loans/${saved.id}`, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <TaskFormLayout
      title={loan ? "Edit loan" : "Add loan"}
      formId="loan-form"
      backTo={loan ? `/expenses/loans/${loan.id}` : "/expenses/recurring"}
      saveLabel={loan ? "Save changes" : "Save loan"}
      saving={isSubmitting}
      canSave={!loan || isDirty}
      onSubmit={() => void submit()}
      summary={
        <>
          <p className="font-medium tabular-nums">
            {values.principal ? formatCurrency(values.principal) : "₹—"}
            {values.annualRate &&
              ` at ${formatNumber(values.annualRate, { minFractionDigits: 2 })}%`}
            {values.tenureMonths && ` for ${values.tenureMonths} months`}
          </p>
          <p className="text-muted-foreground">
            The EMI and its schedule are worked out when you save. Each EMI is recorded as an
            expense with its principal and interest; only interest and charges are costs.
          </p>
        </>
      }
    >
      <FormError message={errors.root?.server?.message} />
      <FormSection number={1} title="Vehicle">
        <FormField
          control={control}
          name="vehicleId"
          label="Vehicle"
          render={(field) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!!loan}>
              <SelectTrigger id={field.id} ref={field.ref} className="h-10 w-full sm:w-80">
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormSection>
      <FormSection number={2} title="Loan">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="lender"
            label="Lender"
            render={(field) => <Input {...field} placeholder="HDFC Bank" className="h-10" />}
          />
          <FormField
            control={control}
            name="accountNumber"
            label="Account number"
            optional
            render={(field) => <Input {...field} placeholder="AL-0042" className="h-10" />}
          />
          <FormField
            control={control}
            name="principal"
            label="Loan amount"
            render={(field) => (
              <NumberInput {...field} prefix="₹" decimals={2} placeholder="800000" />
            )}
          />
          {rateLocked ? (
            <p className="self-end text-sm text-muted-foreground">
              The rate follows its rate changes, on the loan&apos;s page.
            </p>
          ) : (
            <FormField
              control={control}
              name="annualRate"
              label="Interest rate"
              render={(field) => (
                <NumberInput {...field} suffix="% a year" decimals={2} placeholder="9.25" />
              )}
            />
          )}
          <FormField
            control={control}
            name="tenureMonths"
            label="Tenure"
            render={(field) => (
              <NumberInput {...field} suffix="months" decimals={0} placeholder="60" />
            )}
          />
          <FormField
            control={control}
            name="firstEmiDate"
            label="First EMI date"
            render={(field) => (
              <DatePicker
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                value={field.value ? parseISO(field.value) : undefined}
                onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
              />
            )}
          />
          <div className="sm:col-span-2">
            <FormField
              control={control}
              name="method"
              label="Interest"
              render={(field) => (
                <Segmented
                  aria-labelledby={`${field.id}-label`}
                  className="grid w-full grid-cols-2 sm:w-96"
                  value={field.value}
                  onChange={field.onChange}
                  options={Object.values(LoanMethod).map((method) => ({
                    value: method,
                    label: LOAN_METHOD_LABELS[method],
                  }))}
                />
              )}
            />
          </div>
          <FormField
            control={control}
            name="processingFee"
            label="Processing fee"
            optional
            description="For reference; log it as an expense (Finance → Loan processing fee)."
            render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
          />
        </div>
      </FormSection>
      <FormSection number={3} title="EMIs">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="paymentMethod"
            label="Payment method"
            optional
            render={(field) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.id} ref={field.ref} className="h-10 w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PaymentMethod).map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={control}
            name="reminderDays"
            label="Remind me"
            description="Days before each EMI"
            render={(field) => <NumberInput {...field} decimals={0} suffix="days" />}
          />
        </div>
      </FormSection>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskFormLayout>
  );
}
