import {
  type CreateExpenseValues,
  type ExpenseDetail,
  fromPaise,
  PaymentMethod,
  splitEqually,
  toPaise,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import {
  type Control,
  FormProvider,
  type Resolver,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useExpenseCategories, useExpenses } from "@/features/expenses/hooks/use-expenses";
import { useVehicleLoans } from "@/features/expenses/hooks/use-recurring";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate, formatRegistration } from "@/utils/format";

import { CategoryPicker } from "./category-picker";
import {
  CATEGORY_FIELDS,
  categoryKind,
  type ExpenseFormOutput,
  expenseFormSchema,
  type ExpenseFormValues,
  financePreset,
  toExpensePayload,
} from "./expense-form-model";

type ExpenseFormProps = {
  mode: "create" | "edit";
  /** Vehicles in use (the ones an expense can be added to). */
  vehicles: Vehicle[];
  defaultValues: ExpenseFormValues;
  onSave: (values: Omit<CreateExpenseValues, "id">) => Promise<ExpenseDetail>;
};

const isAmount = (value: string) => /^\d+(\.\d{1,2})?$/.test(value);

/**
 * Stitch "Add Expense" / "Edit Expense": one page, numbered sections (vehicle, category, details,
 * category extras) and a summary card that is the review step. Deviation from the prompt's
 * receipt step: no file storage in this project, so no attachments.
 */
export function ExpenseForm({ mode, vehicles, defaultValues, onSave }: ExpenseFormProps) {
  const navigate = useNavigate();
  const form = useForm<ExpenseFormValues, unknown, ExpenseFormOutput>({
    resolver: zodResolver(expenseFormSchema) as unknown as Resolver<
      ExpenseFormValues,
      unknown,
      ExpenseFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting, errors } = form.formState;
  const categories = useExpenseCategories().data ?? [];
  const creating = mode === "create";
  const [categoryId, subcategoryId] = useWatch({
    control: form.control,
    name: ["categoryId", "subcategoryId"],
  });
  const category = categories.find((item) => item.id === categoryId);
  const subcategory = category?.subcategories.find((item) => item.id === subcategoryId);

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await onSave(toExpensePayload(values, financePreset(subcategory)));
      navigate(`/expenses/transactions/${saved.id}`, {
        replace: true,
        state: { savedChanges: true },
      });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field && field in form.getValues()) form.setFocus(field as keyof ExpenseFormValues);
    }
  });

  const save = (
    <Button type="submit" form="expense-form" disabled={isSubmitting || (!creating && !isDirty)}>
      {isSubmitting && <Spinner data-icon="inline-start" />}
      {creating ? "Save expense" : "Save changes"}
    </Button>
  );

  return (
    <TaskPage
      title={creating ? "Add expense" : "Edit expense"}
      closeOnMobile
      subtitle="Every rupee spent on your vehicles"
      backTo="/expenses/transactions"
      backLabel="Back to expenses"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to="/expenses/transactions">Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="expense-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <div className="flex min-w-0 flex-col gap-6">
            <FormError message={errors.root?.server?.message} />
            <Section number={1} title="Vehicle">
              <VehicleSection vehicles={vehicles} />
            </Section>
            <Section number={2} title="Category">
              <CategorySection />
            </Section>
            <Section number={3} title="Details">
              <DetailsSection />
            </Section>
            {categoryKind(category, subcategory) && (
              <Section number={4} title="Additional information">
                <AdditionalSection />
              </Section>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <Summary vehicles={vehicles} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link to="/expenses/transactions">Cancel</Link>
              </Button>
              {save}
            </div>
          </div>
        </form>
      </FormProvider>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <span className="flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground tabular-nums">
            {number}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Form fields read the input values; the resolver's output type isn't their concern. */
function useFields() {
  const context = useFormContext<ExpenseFormValues>();
  return { ...context, control: context.control as Control<ExpenseFormValues> };
}

// ---------------------------------------------------------------- 1 · Vehicle

function VehicleSection({ vehicles }: { vehicles: Vehicle[] }) {
  const { control, setValue, getValues, formState } = useFields();
  const allocation = useWatch({ control, name: "allocation" });
  const amount = useWatch({ control, name: "amount" });
  const error = formState.errors.allocation;
  const setAllocation = (next: Partial<ExpenseFormValues["allocation"]>) =>
    setValue(
      "allocation",
      { ...getValues("allocation"), ...next },
      { shouldDirty: true, shouldValidate: formState.isSubmitted },
    );
  const assigned = allocation.vehicles.reduce(
    (sum, item) => sum + (isAmount(item.amount) ? toPaise(item.amount) : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        aria-label="Vehicle"
        className="w-fit"
        value={allocation.mode}
        onChange={(mode) => {
          // A reading belongs to one vehicle; the field hides when shared.
          if (mode === "shared") {
            setValue("odometerKm", "", {
              shouldDirty: true,
              shouldValidate: formState.isSubmitted,
            });
          }
          setAllocation({ mode });
        }}
        options={[
          { value: "single", label: "One vehicle" },
          { value: "shared", label: "Shared" },
        ]}
      />
      {allocation.mode === "single" ? (
        <FormField
          control={control}
          name="allocation.vehicleId"
          label="Vehicle"
          render={(field) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                className="w-full data-[size=default]:h-10"
              >
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicleName(vehicle)} · {formatRegistration(vehicle.registrationNumber)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2" aria-label="Vehicles sharing this expense">
            {vehicles.map((vehicle) => {
              const share = allocation.vehicles.find((item) => item.vehicleId === vehicle.id);
              return (
                <li
                  key={vehicle.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    id={`share-${vehicle.id}`}
                    checked={!!share}
                    onCheckedChange={(on) =>
                      setAllocation({
                        vehicles: on
                          ? [...allocation.vehicles, { vehicleId: vehicle.id, amount: "" }]
                          : allocation.vehicles.filter((item) => item.vehicleId !== vehicle.id),
                      })
                    }
                  />
                  <label htmlFor={`share-${vehicle.id}`} className="min-w-0 flex-1 text-sm">
                    {vehicleName(vehicle)}{" "}
                    <span className="text-muted-foreground">
                      {formatRegistration(vehicle.registrationNumber)}
                    </span>
                  </label>
                  {share && allocation.split === "custom" && (
                    <div className="w-40">
                      <NumberInput
                        aria-label={`Share for ${vehicleName(vehicle)}`}
                        prefix="₹"
                        decimals={2}
                        value={share.amount}
                        onChange={(value) =>
                          setAllocation({
                            vehicles: allocation.vehicles.map((item) =>
                              item.vehicleId === vehicle.id ? { ...item, amount: value } : item,
                            ),
                          })
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              aria-label="Split"
              className="w-fit"
              value={allocation.split}
              onChange={(split) => setAllocation({ split })}
              options={[
                { value: "equal", label: "Equal" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {allocation.split === "custom" && isAmount(amount) && (
              <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {formatCurrency(fromPaise(assigned))} of {formatCurrency(amount)} assigned
              </span>
            )}
          </div>
          {(error?.vehicles?.message ?? error?.message) && (
            <p role="alert" className="text-sm text-destructive">
              {error?.vehicles?.message ?? error?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 2 · Category

function CategorySection() {
  const { control, setValue, formState } = useFields();
  const categories = useExpenseCategories().data ?? [];
  const recentPage = useExpenses({ page: 1, pageSize: 30 });
  const [categoryId, subcategoryId] = useWatch({ control, name: ["categoryId", "subcategoryId"] });

  const recent = [
    ...new Map(
      (recentPage.data?.items ?? [])
        .filter((item) => item.editable && item.category.key !== "FUEL")
        .map((item) => {
          const choice = {
            categoryId: item.category.id,
            subcategoryId: item.subcategory?.id ?? "",
          };
          return [`${choice.categoryId}:${choice.subcategoryId}`, choice] as const;
        }),
    ).values(),
  ].slice(0, 5);
  const error = formState.errors.categoryId?.message ?? formState.errors.subcategoryId?.message;

  return (
    <div className="flex flex-col gap-2">
      <CategoryPicker
        categories={categories}
        recent={recent}
        value={{ categoryId, subcategoryId }}
        invalid={!!error}
        onChange={(choice) => {
          const opts = { shouldDirty: true, shouldValidate: formState.isSubmitted };
          // Extras belong to the old category: clear them so hidden fields can't block saving.
          if (choice.categoryId !== categoryId) {
            for (const key of CATEGORY_FIELDS) setValue(key, "", opts);
          } else if (choice.subcategoryId !== subcategoryId) {
            // A loan split belongs to its payment type (a preset one is filled in on save).
            for (const key of ["principalAmount", "interestAmount", "chargesAmount"] as const) {
              setValue(key, "", opts);
            }
          }
          setValue("categoryId", choice.categoryId, opts);
          setValue("subcategoryId", choice.subcategoryId, opts);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 3 · Details

/**
 * The vehicle's loan this payment belongs to (a prepayment shortens its schedule). Offered only
 * for one vehicle with loans tracked in the Recurring tab.
 */
function LoanSelect() {
  const { control } = useFields();
  const allocation = useWatch({ control, name: "allocation" });
  const vehicleId = allocation.mode === "single" ? allocation.vehicleId : undefined;
  const loans = useVehicleLoans(vehicleId).data ?? [];
  if (!loans.length) return null;
  return (
    <div className="sm:col-span-3">
      <FormField
        control={control}
        name="loanId"
        label="Loan"
        optional
        description="A part-prepayment here shortens the loan's schedule."
        render={(field) => (
          <Select
            value={field.value || NO_LOAN}
            onValueChange={(value) => field.onChange(value === NO_LOAN ? "" : value)}
          >
            <SelectTrigger id={field.id} ref={field.ref} className="h-10 w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LOAN}>Not one tracked here</SelectItem>
              {loans.map((loan) => (
                <SelectItem key={loan.id} value={loan.id}>
                  {loan.lender}
                  {loan.accountNumber ? ` · ${loan.accountNumber}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

const NO_LOAN = "none";

function DateInput({
  name,
  label,
  optional,
}: {
  name: "date" | "warrantyUntil" | "policyStart" | "policyEnd";
  label: string;
  optional?: boolean;
}) {
  const { control } = useFields();
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
          onChange={(date) => {
            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
            field.onBlur();
          }}
          disabledDates={name === "date" ? { after: new Date() } : undefined}
        />
      )}
    />
  );
}

function MoneyInput({
  name,
  label,
  optional,
  description,
}: {
  name: keyof ExpenseFormValues &
    (
      | "amount"
      | "principalAmount"
      | "interestAmount"
      | "chargesAmount"
      | "loanOutstanding"
      | "partsAmount"
      | "labourAmount"
    );
  label: string;
  optional?: boolean;
  description?: ReactNode;
}) {
  const { control } = useFields();
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      optional={optional}
      description={description}
      render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
    />
  );
}

function TextInput({
  name,
  label,
  placeholder,
  optional = true,
}: {
  name:
    | "title"
    | "vendor"
    | "loanReference"
    | "serviceType"
    | "partsReplaced"
    | "provider"
    | "policyNumber";
  label: string;
  placeholder?: string;
  optional?: boolean;
}) {
  const { control } = useFields();
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      optional={optional}
      render={(field) => <Input {...field} placeholder={placeholder} className="h-10" />}
    />
  );
}

function DetailsSection() {
  const { control } = useFields();
  const shared = useWatch({ control, name: "allocation.mode" }) === "shared";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextInput
          name="title"
          label="Title"
          placeholder="Delhi–Jaipur Expressway"
          optional={false}
        />
      </div>
      <FormField
        control={control}
        name="amount"
        label="Amount"
        render={(field) => (
          <div className="[&_input]:text-2xl [&_[data-slot=input-group]]:h-12">
            <NumberInput {...field} prefix="₹" decimals={2} placeholder="850" />
          </div>
        )}
      />
      <DateInput name="date" label="Date" />
      <FormField
        control={control}
        name="paymentMethod"
        label="Payment method"
        optional
        render={(field) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger
              ref={field.ref}
              id={field.id}
              className="w-full data-[size=default]:h-10"
            >
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PaymentMethod).map((value) => (
                <SelectItem key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <TextInput name="vendor" label="Vendor / workshop" placeholder="3M Car Care, Sector 29" />
      {!shared && (
        <FormField
          control={control}
          name="odometerKm"
          label="Odometer"
          optional
          render={(field) => <NumberInput {...field} suffix="km" placeholder="8,450" />}
        />
      )}
      <FormField
        control={control}
        name="description"
        label="Description"
        optional
        render={(field) => (
          <Input {...field} placeholder="Interior and foam wash" className="h-10" />
        )}
      />
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(field) => (
            <Textarea {...field} rows={2} placeholder="Anything worth remembering" />
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4 · Additional

function AdditionalSection() {
  const { control } = useFields();
  const categories = useExpenseCategories().data ?? [];
  const [categoryId, subcategoryId, amount, principal, interest, charges] = useWatch({
    control,
    name: [
      "categoryId",
      "subcategoryId",
      "amount",
      "principalAmount",
      "interestAmount",
      "chargesAmount",
    ],
  });
  const category = categories.find((item) => item.id === categoryId);
  const subcategory = category?.subcategories.find((item) => item.id === subcategoryId);
  const kind = categoryKind(category, subcategory);
  const preset = financePreset(subcategory);

  if (kind === "finance") {
    const parts = [principal, interest, charges].reduce(
      (sum, part) => sum + (isAmount(part) ? toPaise(part) : 0),
      0,
    );
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {preset ? (
          <p className="text-sm text-muted-foreground sm:col-span-3">
            The whole amount counts as{" "}
            {preset === "PRINCIPAL"
              ? "principal (it reduces the loan and isn't a cost)"
              : preset === "INTEREST"
                ? "interest"
                : "loan charges"}
            .
          </p>
        ) : (
          <>
            <MoneyInput name="principalAmount" label="Principal" />
            <MoneyInput name="interestAmount" label="Interest" />
            <MoneyInput name="chargesAmount" label="Charges" optional />
            {isAmount(amount) && (
              <p
                className="text-sm text-muted-foreground tabular-nums sm:col-span-3"
                aria-live="polite"
              >
                {formatCurrency(fromPaise(parts))} of {formatCurrency(amount)}. Principal reduces
                the loan; only interest and charges are ownership costs.
              </p>
            )}
          </>
        )}
        <LoanSelect />
        <TextInput name="loanReference" label="Loan reference" placeholder="HDFC-AL-0042" />
        <MoneyInput name="loanOutstanding" label="Outstanding balance" optional />
      </div>
    );
  }
  if (kind === "insurance") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="provider" label="Insurance provider" placeholder="ICICI Lombard" />
        <TextInput name="policyNumber" label="Policy reference" placeholder="3001/A/123456" />
        <DateInput name="policyStart" label="Policy start" optional />
        <DateInput name="policyEnd" label="Policy expiry" optional />
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {kind === "maintenance" && (
        <TextInput
          name="serviceType"
          label="Service type"
          placeholder="2nd free service (5,000 km)"
        />
      )}
      <TextInput
        name="partsReplaced"
        label="Parts replaced"
        placeholder="Oil filter, engine oil 0W-16"
      />
      <MoneyInput name="partsAmount" label="Parts cost" optional />
      <MoneyInput name="labourAmount" label="Labour cost" optional />
      <DateInput name="warrantyUntil" label="Warranty until" optional />
    </div>
  );
}

// ---------------------------------------------------------------- Summary (review)

function Summary({ vehicles }: { vehicles: Vehicle[] }) {
  const { control } = useFields();
  const categories = useExpenseCategories().data ?? [];
  const [allocation, categoryId, subcategoryId, amount, date, payment] = useWatch({
    control,
    name: ["allocation", "categoryId", "subcategoryId", "amount", "date", "paymentMethod"],
  });
  const category = categories.find((item) => item.id === categoryId);
  const subcategory = category?.subcategories.find((item) => item.id === subcategoryId);
  const vehicle = (id: string) => vehicles.find((item) => item.id === id);
  const shares =
    allocation.mode === "shared" && allocation.vehicles.length > 1 && isAmount(amount)
      ? allocation.split === "equal"
        ? splitEqually(amount, allocation.vehicles.length)
        : allocation.vehicles.map((item) => item.amount)
      : [];
  const rows: [string, ReactNode][] = [
    [
      "Vehicle",
      allocation.mode === "single"
        ? (vehicle(allocation.vehicleId) && vehicleName(vehicle(allocation.vehicleId)!)) || "—"
        : `Shared · ${allocation.vehicles.length} vehicles`,
    ],
    ["Category", [category?.name, subcategory?.name].filter(Boolean).join(" · ") || "—"],
    ["Date", formatDate(date)],
    ["Payment", payment ? PAYMENT_METHOD_LABELS[payment] : "—"],
  ];
  return (
    <Card aria-label="Summary">
      <CardHeader>
        <CardTitle className="font-heading text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="font-heading text-2xl font-medium tabular-nums">
          {isAmount(amount) ? formatCurrency(amount) : "₹—"}
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>
        {shares.length > 0 && (
          <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
            {allocation.vehicles.map((item, index) => (
              <div key={item.vehicleId} className="flex justify-between gap-3">
                <dt className="truncate text-muted-foreground">
                  {vehicle(item.vehicleId) ? vehicleName(vehicle(item.vehicleId)!) : "Vehicle"}
                </dt>
                <dd className="tabular-nums">
                  {isAmount(shares[index] ?? "") ? formatCurrency(shares[index]!) : "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
