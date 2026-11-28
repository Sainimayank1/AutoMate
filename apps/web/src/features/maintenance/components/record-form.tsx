import {
  breakdownTotal,
  fromPaise,
  MAINTENANCE_GROUPS,
  type MaintenanceSchedule,
  PaymentMethod,
  ServiceRecordType,
  type Vehicle,
  type VehicleComponent,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { CalendarCheck, Plus, ReceiptText, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  FormProvider,
  type Resolver,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import { RECORD_TYPE_LABELS, SCHEDULE_STATUS_META } from "@/features/maintenance/constants";
import { useProviders } from "@/features/maintenance/hooks/use-maintenance";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

import {
  type RecordFormOutput,
  recordFormSchema,
  type RecordFormValues,
} from "./record-form-model";

const NONE = "none";

/**
 * Stitch "Add Service Record" ("Log service") and its edit variant: a task page with numbered
 * sections, the work done (items can complete schedules), the cost breakdown with its total, and
 * a summary. The total shown is the shared `serviceRecordTotal` rule; the API stores its own.
 */
export function RecordForm({
  mode,
  vehicle,
  schedules,
  components,
  completing,
  defaultValues,
  backTo,
  onSave,
}: {
  mode: "create" | "edit";
  vehicle: Vehicle;
  /** The vehicle's schedules, for "Completes schedule". */
  schedules: MaintenanceSchedule[];
  /** Its fitted parts, for "Component" (hidden when there are none). */
  components: VehicleComponent[];
  /** Opened from a schedule's "Mark completed". */
  completing?: MaintenanceSchedule;
  defaultValues: RecordFormValues;
  backTo: string;
  onSave: (values: RecordFormOutput) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const form = useForm<RecordFormValues, unknown, RecordFormOutput>({
    resolver: zodResolver(recordFormSchema) as unknown as Resolver<
      RecordFormValues,
      unknown,
      RecordFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;
  const creating = mode === "create";

  const submit = form.handleSubmit(async (output) => {
    try {
      await onSave(output);
      navigate(backTo, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof RecordFormValues);
    }
  });

  return (
    <TaskPage
      title={creating ? "Log service" : "Edit service record"}
      subtitle={`${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      backTo={backTo}
      backLabel="Back"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="record-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          {completing && (
            <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm lg:col-span-12">
              <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
              Completing {completing.name}
            </div>
          )}
          <RecordFields vehicle={vehicle} schedules={schedules} components={components} />
        </form>
      </FormProvider>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button type="submit" form="record-form" disabled={isSubmitting || (!creating && !isDirty)}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {creating ? "Save record" : "Save changes"}
        </Button>
      </footer>

      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function RecordFields({
  vehicle,
  schedules,
  components,
}: {
  vehicle: Vehicle;
  schedules: MaintenanceSchedule[];
  components: VehicleComponent[];
}) {
  const form = useFormContext<RecordFormValues>();
  const { control } = form;
  const { errors } = form.formState;
  const values = useWatch({ control });
  const items = useFieldArray({ control, name: "items" });
  const providers = useProviders().data ?? [];

  const computed = breakdownTotal(values);
  const total =
    computed !== null
      ? fromPaise(Math.max(0, computed))
      : values.totalAmount
        ? values.totalAmount.replace(/,/g, "")
        : "0";
  const completes = (values.items ?? [])
    .map((item) => schedules.find((schedule) => schedule.id === item.scheduleId)?.name)
    .filter(Boolean);

  const money = (
    name: "labourAmount" | "partsAmount" | "otherAmount" | "taxAmount" | "discountAmount",
    label: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={errors.root?.server?.message} />
        <FormSection step={1} title="What">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="type"
              label="Record type"
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ServiceRecordType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {RECORD_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={control}
              name="categoryKey"
              label="What it's for"
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    onBlur={field.onBlur}
                    className="w-full"
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_GROUPS.map((group) => (
                      <SelectGroup key={group.key}>
                        <SelectLabel>{group.name}</SelectLabel>
                        {group.items.map(([item, name]) => (
                          <SelectItem key={item} value={`${group.key}.${item}`}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <div className="sm:col-span-2">
              <FormField
                control={control}
                name="title"
                label="Title"
                render={(field) => (
                  <Input {...field} placeholder="e.g. 2nd free periodic service" maxLength={120} />
                )}
              />
            </div>
          </div>
        </FormSection>

        <FormSection step={2} title="When & where">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="serviceDate"
              label="Service date"
              description="Can be in the past"
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
                  placeholder="DD/MM/YYYY"
                  disabledDates={{ after: new Date() }}
                />
              )}
            />
            <FormField
              control={control}
              name="odometerKm"
              label="Odometer"
              description={`Vehicle odometer: ${formatDistance(vehicle.odometerKm)}`}
              render={(field) => (
                <NumberInput
                  {...field}
                  suffix="km"
                  placeholder={formatNumber(vehicle.odometerKm)}
                />
              )}
            />
            <FormField
              control={control}
              name="providerName"
              label="Workshop"
              optional
              description="New names are saved to your workshops"
              render={(field) => (
                <>
                  <Input
                    {...field}
                    list="workshop-suggestions"
                    autoComplete="off"
                    placeholder="e.g. Maruti Arena Service, Gurugram"
                    maxLength={120}
                  />
                  <datalist id="workshop-suggestions">
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.name} />
                    ))}
                  </datalist>
                </>
              )}
            />
            <FormField
              control={control}
              name="technician"
              label="Technician"
              optional
              render={(field) => <Input {...field} maxLength={80} />}
            />
          </div>
        </FormSection>

        <FormSection
          step={3}
          title="Work done"
          aside={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                items.append({ name: "", partNumber: "", scheduleId: "", componentId: "" })
              }
            >
              <Plus data-icon="inline-start" />
              Add item
            </Button>
          }
        >
          {items.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet. Add what was done, and link the items that complete a schedule.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.fields.map((item, index) => (
                <li
                  key={item.id}
                  className="grid items-end gap-3 rounded-lg border bg-muted/40 p-3.5 sm:grid-cols-12"
                >
                  <div className="sm:col-span-4">
                    <FormField
                      control={control}
                      name={`items.${index}.name`}
                      label="Item"
                      render={(field) => (
                        <Input {...field} placeholder="e.g. Engine oil 0W-20" maxLength={120} />
                      )}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <FormField
                      control={control}
                      name={`items.${index}.partNumber`}
                      label="Part number"
                      optional
                      render={(field) => <Input {...field} className="font-mono" maxLength={60} />}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <FormField
                      control={control}
                      name={`items.${index}.scheduleId`}
                      label="Completes schedule"
                      render={(field) => (
                        <Select
                          value={field.value || NONE}
                          onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                        >
                          <SelectTrigger
                            ref={field.ref}
                            id={field.id}
                            aria-invalid={field["aria-invalid"]}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>None</SelectItem>
                            {schedules.map((schedule) => (
                              <SelectItem key={schedule.id} value={schedule.id}>
                                {schedule.name} ·{" "}
                                {SCHEDULE_STATUS_META[schedule.due.status].label.toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {components.length > 0 && (
                    <div className="sm:col-span-11">
                      <FormField
                        control={control}
                        name={`items.${index}.componentId`}
                        label="Component"
                        optional
                        render={(field) => (
                          <Select
                            value={field.value || NONE}
                            onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                          >
                            <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {components.map((part) => (
                                <SelectItem key={part.id} value={part.id}>
                                  {[part.name, part.brand].filter(Boolean).join(" · ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                  <div className="flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => items.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            Items that complete a schedule restart its countdown from this date and reading.
          </p>
        </FormSection>

        <FormSection step={4} title="Cost">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {money("labourAmount", "Labour")}
            {money("partsAmount", "Parts")}
            {money("otherAmount", "Other")}
            {money("taxAmount", "Tax")}
            {money("discountAmount", "Discount")}
          </div>
          <div className="grid items-start gap-4 border-t pt-4 sm:grid-cols-2">
            {computed !== null ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">Total</span>
                <p
                  className="rounded-md border bg-muted px-3 py-2 font-mono text-sm font-medium tabular-nums"
                  aria-live="polite"
                >
                  {formatCurrency(total)}
                </p>
                <span className="text-xs text-muted-foreground">Computed from the breakdown</span>
              </div>
            ) : (
              <FormField
                control={control}
                name="totalAmount"
                label="Total"
                description="Or enter the breakdown above"
                render={(field) => (
                  <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />
                )}
              />
            )}
            <FormField
              control={control}
              name="paymentMethod"
              label="Payment method"
              optional
              render={(field) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                >
                  <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not recorded</SelectItem>
                    {Object.values(PaymentMethod).map((method) => (
                      <SelectItem key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Saved to Expenses as Maintenance &amp; servicing (or Repairs for repair types). ₹0
            records create no expense.
          </p>
        </FormSection>

        <FormSection step={5} title="Warranty & notes">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="warrantyUntil"
              label="Warranty until"
              optional
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
                  placeholder="DD/MM/YYYY"
                />
              )}
            />
            <FormField
              control={control}
              name="warrantyNotes"
              label="Warranty details"
              optional
              render={(field) => (
                <Input {...field} placeholder="e.g. 6 months on parts" maxLength={300} />
              )}
            />
          </div>
          <FormField
            control={control}
            name="description"
            label="Description"
            optional
            render={(field) => <Textarea {...field} rows={2} maxLength={500} />}
          />
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => <Textarea {...field} rows={2} maxLength={1000} />}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-medium">Summary</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {RECORD_TYPE_LABELS[values.type ?? ServiceRecordType.ROUTINE_SERVICE]}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3.5">
          <span className="font-medium">{values.title || "Untitled record"}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {[
              values.serviceDate && formatDate(values.serviceDate),
              values.odometerKm && `${values.odometerKm} km`,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </span>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryRow label="Workshop">{values.providerName || "—"}</SummaryRow>
          <SummaryRow label="Items">{formatNumber(values.items?.length ?? 0)}</SummaryRow>
          <SummaryRow label="Completes">{completes.length ? completes.join(", ") : "—"}</SummaryRow>
        </dl>
        <div className="flex items-baseline justify-between gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-heading text-2xl font-medium tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
        <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ReceiptText className="size-4 shrink-0" aria-hidden />
          {Number(total) > 0 ? "Its expense is saved with it" : "No expense: it cost nothing"}
        </p>
      </aside>
    </>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
