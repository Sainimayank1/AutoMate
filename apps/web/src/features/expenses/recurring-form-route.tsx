import {
  CostClass,
  createRecurringExpenseSchema,
  type CreateRecurringExpenseValues,
  PaymentMethod,
  RECURRENCE_PRESETS,
  RecurrenceUnit,
  type RecurringExpense,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { type Control, type Resolver, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import { CategoryPicker } from "@/features/expenses/components/category-picker";
import { FormSection, TaskFormLayout } from "@/features/expenses/components/task-form-layout";
import { frequencyLabel } from "@/features/expenses/constants";
import { useExpenseCategories } from "@/features/expenses/hooks/use-expenses";
import {
  useCreateRecurring,
  useRecurringSchedule,
  useUpdateRecurring,
} from "@/features/expenses/hooks/use-recurring";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate } from "@/utils/format";

type Frequency = keyof typeof RECURRENCE_PRESETS | "custom";

type RecurringForm = {
  vehicleId: string;
  categoryId: string;
  subcategoryId: string;
  title: string;
  amount: string;
  paymentMethod: PaymentMethod | "";
  vendor: string;
  notes: string;
  frequency: Frequency;
  every: string;
  unit: RecurrenceUnit;
  startDate: string;
  endDate: string;
  reminderDays: string;
};

/** The frequency choice becomes every × unit; the shared schema checks the rest. */
const formSchema = z.preprocess((value) => {
  const { frequency, ...rest } = value as RecurringForm;
  const preset = frequency === "custom" ? null : RECURRENCE_PRESETS[frequency];
  return preset ? { ...rest, every: preset.every, unit: preset.unit } : rest;
}, createRecurringExpenseSchema) as unknown as z.ZodType<
  CreateRecurringExpenseValues,
  RecurringForm
>;

const presetOf = (every: number, unit: RecurrenceUnit): Frequency =>
  (Object.entries(RECURRENCE_PRESETS).find(
    ([, preset]) => preset.every === every && preset.unit === unit,
  )?.[0] as Frequency | undefined) ?? "custom";

const toForm = (vehicleId: string, schedule?: RecurringExpense): RecurringForm => ({
  vehicleId: schedule?.vehicleId ?? vehicleId,
  categoryId: schedule?.category.id ?? "",
  subcategoryId: schedule?.subcategory?.id ?? "",
  title: schedule?.title ?? "",
  amount: schedule?.amount.replace(/\.00$/, "") ?? "",
  paymentMethod: schedule?.paymentMethod ?? "",
  vendor: schedule?.vendor ?? "",
  notes: schedule?.notes ?? "",
  frequency: schedule ? presetOf(schedule.every, schedule.unit) : "monthly",
  every: String(schedule?.every ?? 1),
  unit: schedule?.unit ?? RecurrenceUnit.MONTH,
  startDate: schedule?.startDate ?? format(new Date(), "yyyy-MM-dd"),
  endDate: schedule?.endDate ?? "",
  reminderDays: String(schedule?.reminderDays ?? 3),
});

/**
 * `/expenses/recurring/new` and `/expenses/recurring/:id/edit` (Stitch "Add Recurring Payment"):
 * a schedule, never a payment. Loans aren't added here: their EMIs need the loan's split.
 */
export function Component() {
  const { recurringId } = useParams();
  const garage = useActiveVehicle();
  const categories = useExpenseCategories();
  const schedule = useRecurringSchedule(recurringId);

  if (garage.isPending || categories.isPending || (recurringId && schedule.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (garage.isError || categories.isError || schedule.isError) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load the form"
        error={garage.error ?? categories.error ?? schedule.error}
        onRetry={() =>
          void Promise.all([garage.refetch(), categories.refetch(), schedule.refetch()])
        }
      />
    );
  }
  return (
    <RecurringFormPage
      vehicles={garage.vehicles}
      defaults={toForm(garage.activeVehicle?.id ?? "", schedule.data)}
      id={recurringId}
    />
  );
}

function RecurringFormPage({
  vehicles,
  defaults,
  id,
}: {
  vehicles: Vehicle[];
  defaults: RecurringForm;
  id?: string;
}) {
  const navigate = useNavigate();
  const create = useCreateRecurring();
  const update = useUpdateRecurring(id ?? "");
  const all = useExpenseCategories().data ?? [];
  // Loan payments come from a loan (their split); fuel from fill-ups.
  const categories = all.filter((category) => category.costClass !== CostClass.FINANCING);
  const form = useForm<RecurringForm, unknown, CreateRecurringExpenseValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<
      RecurringForm,
      unknown,
      CreateRecurringExpenseValues
    >,
    defaultValues: defaults,
    mode: "onTouched",
  });
  const control = form.control as unknown as Control<RecurringForm>;
  const { isDirty, isSubmitting, errors } = form.formState;
  const values = useWatch({ control });

  const submit = form.handleSubmit(async (output) => {
    try {
      if (id) {
        const { vehicleId: _vehicle, ...changes } = output;
        await update.mutateAsync(changes);
      } else {
        await create.mutateAsync(output);
      }
      navigate("/expenses/recurring", { replace: true });
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  const every = values.frequency === "custom" ? Number(values.every) || 1 : null;
  const often =
    values.frequency && values.frequency !== "custom"
      ? RECURRENCE_PRESETS[values.frequency].label.toLowerCase()
      : frequencyLabel(every ?? 1, values.unit ?? RecurrenceUnit.MONTH).toLowerCase();

  const vehicle = vehicles.find((item) => item.id === values.vehicleId);
  const category = all.find((item) => item.id === values.categoryId);
  const summaryRows: [string, string][] = [
    ["Vehicle", vehicle ? vehicleName(vehicle) : "—"],
    [
      "Category",
      category
        ? (category.subcategories.find((item) => item.id === values.subcategoryId)?.name ??
          category.name)
        : "—",
    ],
    ["Payment", values.paymentMethod ? PAYMENT_METHOD_LABELS[values.paymentMethod] : "—"],
    ["Reminder", `${values.reminderDays || 0} days before`],
  ];

  return (
    <TaskFormLayout
      title={id ? "Edit recurring payment" : "Add recurring payment"}
      formId="recurring-form"
      backTo="/expenses/recurring"
      saveLabel={id ? "Save changes" : "Save recurring payment"}
      saving={isSubmitting}
      canSave={!id || isDirty}
      onSubmit={() => void submit()}
      summary={
        <>
          <p className="font-medium tabular-nums">
            {values.amount ? formatCurrency(values.amount) : "₹—"} {often}
            {values.startDate && ` from ${formatDate(values.startDate)}`}
          </p>
          <dl className="flex flex-col divide-y text-sm">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground">
            Nothing is spent until you record a payment: each due date becomes an expense only then.
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
            <Select value={field.value} onValueChange={field.onChange} disabled={!!id}>
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
      <FormSection number={2} title="Category">
        <div className="flex flex-col gap-2">
          <CategoryPicker
            categories={categories}
            recent={[]}
            value={{
              categoryId: values.categoryId ?? "",
              subcategoryId: values.subcategoryId ?? "",
            }}
            onChange={(choice) => {
              form.setValue("categoryId", choice.categoryId, {
                shouldDirty: true,
                shouldValidate: true,
              });
              form.setValue("subcategoryId", choice.subcategoryId, { shouldDirty: true });
            }}
            invalid={!!errors.categoryId}
          />
          {errors.categoryId?.message && (
            <p className="text-sm text-destructive">{errors.categoryId.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            A loan&apos;s EMIs aren&apos;t added here: add the loan, and its EMIs are scheduled with
            their principal and interest.
          </p>
        </div>
      </FormSection>
      <FormSection number={3} title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={control}
            name="title"
            label="Title"
            render={(field) => (
              <Input {...field} placeholder="Society parking pass" className="h-10" />
            )}
          />
          <FormField
            control={control}
            name="amount"
            label="Amount"
            render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
          />
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
            name="vendor"
            label="Vendor"
            optional
            render={(field) => (
              <Input {...field} placeholder="Prestige Towers RWA" className="h-10" />
            )}
          />
          <div className="sm:col-span-2">
            <FormField
              control={control}
              name="notes"
              label="Notes"
              optional
              render={(field) => <Textarea {...field} rows={2} />}
            />
          </div>
        </div>
      </FormSection>
      <FormSection number={4} title="Schedule">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField
              control={control}
              name="frequency"
              label="Frequency"
              render={(field) => (
                <Segmented
                  aria-labelledby={`${field.id}-label`}
                  className="flex w-full flex-wrap"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    ...Object.entries(RECURRENCE_PRESETS).map(([value, preset]) => ({
                      value: value as Frequency,
                      label: preset.label,
                    })),
                    { value: "custom" as const, label: "Custom" },
                  ]}
                />
              )}
            />
          </div>
          {values.frequency === "custom" && (
            <>
              <FormField
                control={control}
                name="every"
                label="Every"
                render={(field) => <NumberInput {...field} decimals={0} placeholder="2" />}
              />
              <FormField
                control={control}
                name="unit"
                label="Unit"
                render={(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={field.id} ref={field.ref} className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RecurrenceUnit.DAY}>Days</SelectItem>
                      <SelectItem value={RecurrenceUnit.WEEK}>Weeks</SelectItem>
                      <SelectItem value={RecurrenceUnit.MONTH}>Months</SelectItem>
                      <SelectItem value={RecurrenceUnit.YEAR}>Years</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </>
          )}
          <DateField control={control} name="startDate" label="First due date" />
          <DateField control={control} name="endDate" label="Ends on" optional />
          <FormField
            control={control}
            name="reminderDays"
            label="Remind me"
            description="Days before each due date"
            render={(field) => <NumberInput {...field} decimals={0} suffix="days" />}
          />
        </div>
      </FormSection>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskFormLayout>
  );
}

function DateField({
  control,
  name,
  label,
  optional,
}: {
  control: Control<RecurringForm>;
  name: "startDate" | "endDate";
  label: string;
  optional?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      optional={optional}
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
  );
}
