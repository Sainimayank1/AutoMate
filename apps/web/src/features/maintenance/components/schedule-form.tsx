import {
  DEFAULT_REMINDER_LEAD,
  MAINTENANCE_GROUPS,
  maintenanceCategoryName,
  SchedulePriority,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import { PRIORITY_LABELS } from "@/features/maintenance/constants";
import { useComponents } from "@/features/maintenance/hooks/use-maintenance";
import { usePreferences } from "@/features/settings/hooks/use-settings";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

import {
  type ScheduleFormOutput,
  scheduleFormSchema,
  type ScheduleFormValues,
  type ScheduleKind,
} from "./schedule-form-model";

const BACK_TO = "/maintenance/schedules";
const NO_COMPONENT = "none";
const PRIORITIES = Object.values(SchedulePriority).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));
const KINDS: { value: ScheduleKind; label: string }[] = [
  { value: "REPEATS", label: "Repeats" },
  { value: "ONCE", label: "Once" },
];

/**
 * Stitch "Add Schedule" (and its edit variant): a focused task page with numbered sections and a
 * summary. Deviation: the summary shows the interval and what it counts from but not the next due
 * date or reading; those come from the API once saved (no due maths in the web).
 */
export function ScheduleForm({
  mode,
  vehicle,
  defaultValues,
  backTo = BACK_TO,
  onSave,
}: {
  mode: "create" | "edit";
  vehicle: Vehicle;
  defaultValues: ScheduleFormValues;
  /** Where saving and cancelling go (default: the schedules list). */
  backTo?: string;
  onSave: (values: ScheduleFormOutput) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema) as unknown as Resolver<
      ScheduleFormValues,
      unknown,
      ScheduleFormOutput
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
      if (field) form.setFocus(field as keyof ScheduleFormValues);
    }
  });

  return (
    <TaskPage
      title={creating ? "Add schedule" : "Edit schedule"}
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
          id="schedule-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <ScheduleFields vehicle={vehicle} />
        </form>
      </FormProvider>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          form="schedule-form"
          disabled={isSubmitting || (!creating && !isDirty)}
        >
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {creating ? "Save schedule" : "Save changes"}
        </Button>
      </footer>

      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

/** The sections and the summary; reads the form from context (FormProvider). */
function ScheduleFields({ vehicle }: { vehicle: Vehicle }) {
  const form = useFormContext<ScheduleFormValues>();
  const { control } = form;
  const { errors } = form.formState;
  const values = useWatch({ control });
  const timing = usePreferences().data?.reminderTiming;
  // Blank lead fields fall back to the user's default (Settings), then the app's.
  const lead = {
    days: timing?.serviceLeadDays ?? DEFAULT_REMINDER_LEAD.days,
    km: timing?.serviceLeadKm ?? DEFAULT_REMINDER_LEAD.km,
  };
  const repeats = values.kind === "REPEATS";
  const components = useComponents(vehicle.id, { pageSize: 100 }).data?.items ?? [];

  const dateField = (name: "lastDoneDate" | "dueDate", label: string, pastOnly: boolean) => (
    <FormField
      control={control}
      name={name}
      label={label}
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
          disabledDates={pastOnly ? { after: new Date() } : undefined}
        />
      )}
    />
  );
  const kmField = (
    name: "intervalKm" | "lastDoneKm" | "dueKm" | "leadKm",
    label: string,
    placeholder: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field) => <NumberInput {...field} suffix="km" placeholder={placeholder} />}
    />
  );

  const interval = [
    values.intervalKm && `${formatNumber(Number(values.intervalKm.replace(/,/g, "")))} km`,
    values.intervalMonths && `${values.intervalMonths} months`,
  ].filter(Boolean);
  const due = [
    values.dueKm && `at ${formatNumber(Number(values.dueKm.replace(/,/g, "")))} km`,
    values.dueDate && `on ${formatDate(values.dueDate)}`,
  ].filter(Boolean);
  const preview = repeats
    ? interval.length
      ? `Every ${interval.join(" or ")}`
      : "Set an interval"
    : due.length
      ? `Once ${due.join(" or ")}`
      : "Set a due date or reading";
  const baseline =
    repeats && (values.lastDoneDate || values.lastDoneKm)
      ? [
          values.lastDoneDate && formatDate(values.lastDoneDate),
          values.lastDoneKm && `${values.lastDoneKm} km`,
        ]
          .filter(Boolean)
          .join(" · ")
      : `${formatDate(new Date())} · ${formatDistance(vehicle.odometerKm)}`;

  return (
    <>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={errors.root?.server?.message} />
        <FormSection step={1} title="What">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                control={control}
                name="name"
                label="Name"
                render={(field) => (
                  <Input {...field} placeholder="e.g. Engine oil & filter" maxLength={80} />
                )}
              />
            </div>
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
            <FormField
              control={control}
              name="priority"
              label="Priority"
              render={(field) => (
                <Segmented
                  value={field.value}
                  options={PRIORITIES}
                  onChange={field.onChange}
                  aria-labelledby={`${field.id}-label`}
                  className="w-full"
                />
              )}
            />
            {components.length > 0 && (
              <div className="sm:col-span-2">
                <FormField
                  control={control}
                  name="componentId"
                  label="Watches component"
                  optional
                  description="Its status shows “inspection due” when this schedule is due"
                  render={(field) => (
                    <Select
                      value={field.value || NO_COMPONENT}
                      onValueChange={(value) => field.onChange(value === NO_COMPONENT ? "" : value)}
                    >
                      <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COMPONENT}>None</SelectItem>
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
          </div>
        </FormSection>

        <FormSection
          step={2}
          title="When"
          aside={
            <Segmented
              value={values.kind ?? "REPEATS"}
              options={KINDS}
              onChange={(kind) => {
                form.setValue("kind", kind, { shouldDirty: true });
                const cleared =
                  kind === "REPEATS"
                    ? (["dueDate", "dueKm"] as const)
                    : (["intervalKm", "intervalMonths", "lastDoneDate", "lastDoneKm"] as const);
                for (const name of cleared) form.setValue(name, "", { shouldDirty: true });
                form.clearErrors();
              }}
              aria-label="Repeats or once"
            />
          }
        >
          {repeats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {kmField("intervalKm", "Every", "10,000")}
                <FormField
                  control={control}
                  name="intervalMonths"
                  label="and/or every"
                  render={(field) => <NumberInput {...field} suffix="months" placeholder="12" />}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Due at whichever comes first. Use your owner's manual for the right interval.
              </p>
              <div className="flex flex-col gap-3 border-t pt-4">
                <span className="text-sm font-medium">
                  Last done <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <div className="grid gap-4 sm:grid-cols-2">
                  {dateField("lastDoneDate", "Date", true)}
                  {kmField("lastDoneKm", "Odometer", formatNumber(vehicle.odometerKm))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Leave blank to count from today and {formatDistance(vehicle.odometerKm)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {dateField("dueDate", "Due date", false)}
                {kmField("dueKm", "Due odometer", "12,000")}
              </div>
              <p className="text-sm text-muted-foreground">Whichever comes first.</p>
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="estimatedCost"
                  label="Estimated cost"
                  optional
                  render={(field) => (
                    <NumberInput {...field} prefix="₹" decimals={2} placeholder="24,000" />
                  )}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                For planning on the Planner; it's never counted as spend.
              </p>
            </>
          )}
        </FormSection>

        <FormSection
          step={3}
          title="Reminders"
          aside={
            <FormField
              control={control}
              name="remindersEnabled"
              label="Remind me"
              render={(field) => (
                <Switch
                  ref={field.ref}
                  id={field.id}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="leadDays"
              label="Lead time"
              render={(field) => (
                <NumberInput {...field} suffix="days" placeholder={String(lead.days)} />
              )}
            />
            {kmField("leadKm", "and", formatNumber(lead.km))}
          </div>
          <p className="text-sm text-muted-foreground">
            It shows as due soon this early. Notifications arrive when the Notifications centre is
            available.
          </p>
        </FormSection>

        <FormSection step={4} title="Notes">
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => (
              <Textarea
                {...field}
                rows={3}
                maxLength={1000}
                placeholder="Oil grade, part numbers or workshop notes"
              />
            )}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Summary</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {PRIORITY_LABELS[values.priority ?? "NORMAL"]}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3.5">
          <span className="text-xs text-muted-foreground">Schedule</span>
          <p className="text-sm font-medium tabular-nums">{preview}</p>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryRow label="Vehicle">{vehicleName(vehicle)}</SummaryRow>
          <SummaryRow label="For">
            {values.categoryKey ? maintenanceCategoryName(values.categoryKey) : "—"}
          </SummaryRow>
          {repeats && <SummaryRow label="Counts from">{baseline}</SummaryRow>}
          <SummaryRow label="Reminders">
            {values.remindersEnabled
              ? `${values.leadDays || lead.days} days or ${values.leadKm || formatNumber(lead.km)} km before`
              : "Off"}
          </SummaryRow>
        </dl>
      </aside>
    </>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}
