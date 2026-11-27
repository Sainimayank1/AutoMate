import {
  COMPONENT_KINDS,
  ComponentCondition,
  componentFieldsSchema,
  componentKindName,
  type CreateComponentValues,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import type { z } from "zod";

import type { ComponentFormValues } from "./component-form-model";

const schema = componentFieldsSchema.omit({ id: true });
type Output = z.output<typeof schema>;

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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import { CONDITION_LABELS } from "@/features/maintenance/constants";
import { useProviders } from "@/features/maintenance/hooks/use-maintenance";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

/**
 * Stitch "Add Component" (and its edit variant): what the part is, when it was fitted, its
 * lifespan and warranty. Editing leaves the condition alone (inspections change it).
 * Deviation: the summary shows no estimated replacement date; the API computes it once saved.
 */
export function ComponentForm({
  mode,
  vehicle,
  defaultValues,
  backTo,
  onSave,
}: {
  mode: "create" | "edit";
  vehicle: Vehicle;
  defaultValues: ComponentFormValues;
  backTo: string;
  onSave: (values: Omit<CreateComponentValues, "id">) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const form = useForm<ComponentFormValues, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<ComponentFormValues, unknown, Output>,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;
  const creating = mode === "create";

  const submit = form.handleSubmit(async (output) => {
    try {
      await onSave(creating ? output : { ...output, condition: undefined });
      navigate(backTo, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof ComponentFormValues);
    }
  });

  return (
    <TaskPage
      title={creating ? "Add component" : "Edit component"}
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
          id="component-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <ComponentFields creating={creating} vehicle={vehicle} />
        </form>
      </FormProvider>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          form="component-form"
          disabled={isSubmitting || (!creating && !isDirty)}
        >
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {creating ? "Save component" : "Save changes"}
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function ComponentFields({ creating, vehicle }: { creating: boolean; vehicle: Vehicle }) {
  const form = useFormContext<ComponentFormValues>();
  const { control } = form;
  const values = useWatch({ control });
  const providers = useProviders().data ?? [];

  const date = (name: "installedAt" | "warrantyUntil", label: string, pastOnly: boolean) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => (
        <DatePicker
          ref={field.ref}
          id={field.id}
          aria-invalid={field["aria-invalid"]}
          value={field.value ? parseISO(field.value) : undefined}
          onChange={(next) => {
            field.onChange(next ? format(next, "yyyy-MM-dd") : "");
            field.onBlur();
          }}
          placeholder="DD/MM/YYYY"
          disabledDates={pastOnly ? { after: new Date() } : undefined}
        />
      )}
    />
  );
  const number = (
    name: "installedKm" | "expectedLifeKm" | "expectedLifeMonths" | "warrantyKm",
    label: string,
    suffix: string,
    placeholder: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <NumberInput {...field} suffix={suffix} placeholder={placeholder} />}
    />
  );
  const textField = (
    name: "position" | "brand" | "partNumber",
    label: string,
    placeholder: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <Input {...field} placeholder={placeholder} maxLength={60} />}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormSection step={1} title="What">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="kind"
              label="Kind"
              render={(field) => (
                <Select
                  value={field.value}
                  onValueChange={(kind) => {
                    // A name still matching the old kind follows the new one.
                    const name = form.getValues("name");
                    if (!name || name === componentKindName(field.value)) {
                      form.setValue("name", componentKindName(kind), { shouldDirty: true });
                    }
                    field.onChange(kind);
                  }}
                >
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    className="w-full"
                  >
                    <SelectValue placeholder="Choose what it is" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_KINDS.map(([kind, name]) => (
                      <SelectItem key={kind} value={kind}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={control}
              name="name"
              label="Name"
              render={(field) => <Input {...field} placeholder="e.g. 12V battery" maxLength={80} />}
            />
            {textField("position", "Position", "e.g. Front pair")}
            {textField("brand", "Brand", "e.g. Amaron Pro")}
            {textField("partNumber", "Part number", "e.g. 38B20L")}
          </div>
        </FormSection>

        <FormSection step={2} title="Fitted">
          <div className="grid gap-4 sm:grid-cols-2">
            {date("installedAt", "Installed on", true)}
            {number("installedKm", "Odometer", "km", formatNumber(vehicle.odometerKm))}
            <FormField
              control={control}
              name="providerName"
              label="Workshop"
              optional
              render={(field) => (
                <>
                  <Input {...field} list="component-workshops" autoComplete="off" maxLength={120} />
                  <datalist id="component-workshops">
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.name} />
                    ))}
                  </datalist>
                </>
              )}
            />
            {creating && (
              <FormField
                control={control}
                name="condition"
                label="Condition"
                description="Your own reading; record inspections to update it"
                render={(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ComponentCondition).map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          {CONDITION_LABELS[condition]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </div>
        </FormSection>

        <FormSection step={3} title="Lifespan & warranty">
          <div className="grid gap-4 sm:grid-cols-2">
            {number("expectedLifeKm", "Expected life", "km", "40,000")}
            {number("expectedLifeMonths", "and/or", "months", "48")}
          </div>
          <p className="text-sm text-muted-foreground">
            Your estimate, e.g. from the maker or workshop. Used only for estimates.
          </p>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            {date("warrantyUntil", "Warranty until", false)}
            {number("warrantyKm", "Warranty up to", "km", "60,000")}
          </div>
        </FormSection>

        <FormSection step={4} title="Notes">
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => <Textarea {...field} rows={3} maxLength={1000} />}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
        <h2 className="font-heading text-lg font-semibold">Summary</h2>
        <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3.5">
          <span className="font-medium">
            {values.name || (values.kind ? componentKindName(values.kind) : "New component")}
          </span>
          <span className="text-sm text-muted-foreground">
            {[values.brand, values.partNumber, values.position].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryRow label="Installed">
            {[
              values.installedAt && formatDate(values.installedAt),
              values.installedKm && `${values.installedKm} km`,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </SummaryRow>
          <SummaryRow label="Lifespan">
            {[
              values.expectedLifeKm && `${values.expectedLifeKm} km`,
              values.expectedLifeMonths && `${values.expectedLifeMonths} months`,
            ]
              .filter(Boolean)
              .join(" or ") || "Not set"}
          </SummaryRow>
          <SummaryRow label="Warranty">
            {[
              values.warrantyUntil && formatDate(values.warrantyUntil),
              values.warrantyKm && `${values.warrantyKm} km`,
            ]
              .filter(Boolean)
              .join(" or ") || "None"}
          </SummaryRow>
        </dl>
      </aside>
    </>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}
