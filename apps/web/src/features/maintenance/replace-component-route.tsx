import {
  istToday,
  PaymentMethod,
  replaceComponentSchema,
  type VehicleComponentDetail,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { ArrowRight, Info, SearchX } from "lucide-react";
import { useState } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
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
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import {
  useComponent,
  useProviders,
  useReplaceComponent,
} from "@/features/maintenance/hooks/use-maintenance";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const schema = replaceComponentSchema.omit({ id: true });
type Output = z.output<typeof schema>;
type Values = {
  date: string;
  odometerKm: string;
  providerName: string;
  brand: string;
  partNumber: string;
  expectedLifeKm: string;
  expectedLifeMonths: string;
  warrantyUntil: string;
  warrantyKm: string;
  totalAmount: string;
  paymentMethod: PaymentMethod | "";
  notes: string;
};
const NONE = "none";
const text = (value: number | null) => (value == null ? "" : String(value));

/** `/maintenance/components/:componentId/replace`: a part of the active vehicle. */
export function Component() {
  const { componentId = "" } = useParams();
  const garage = useActiveVehicle();
  const vehicle = garage.activeVehicle;
  const part = useComponent(vehicle?.id ?? "", componentId);

  if (garage.isPending || (vehicle && part.isPending))
    return <LoadingState fullScreen label="Loading…" />;
  if (!vehicle || !part.data || part.data.state !== "INSTALLED") {
    return (
      <EmptyState
        className="min-h-svh"
        icon={SearchX}
        title="Nothing to replace"
        description="This part isn't fitted to the active vehicle (it may already be replaced or removed)."
        action={
          <Button variant="outline" asChild>
            <Link to="/maintenance/components">Back to components</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ReplaceForm
      part={part.data}
      vehicleLabel={`${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
    />
  );
}

/**
 * Stitch "Replace Component": when and where, the new part (lifespan prefilled from the old one),
 * the cost and notes. The API keeps the old part as history, fits the new one and logs a
 * "Component replacement" service record (its cost to Expenses, its schedules restarted).
 */
function ReplaceForm({
  part,
  vehicleLabel,
}: {
  part: VehicleComponentDetail;
  vehicleLabel: string;
}) {
  const navigate = useNavigate();
  const replace = useReplaceComponent(part.vehicleId, part.id);
  // One id per visit: a retried save returns the part it already fitted.
  const [id] = useState(() => crypto.randomUUID());
  const backTo = `/maintenance/components/${part.id}`;
  const form = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<Values, unknown, Output>,
    defaultValues: {
      date: istToday(new Date()),
      odometerKm: "",
      providerName: "",
      brand: "",
      partNumber: "",
      expectedLifeKm: text(part.expectedLifeKm),
      expectedLifeMonths: text(part.expectedLifeMonths),
      warrantyUntil: "",
      warrantyKm: "",
      totalAmount: "",
      paymentMethod: "",
      notes: "",
    },
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (output) => {
    try {
      const fresh = await replace.mutateAsync({ ...output, id });
      navigate(`/maintenance/components/${fresh.id}`, {
        replace: true,
        state: { savedChanges: true },
      });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof Values);
    }
  });

  return (
    <TaskPage
      title={`Replace ${part.name.toLowerCase()}`}
      subtitle={vehicleLabel}
      backTo={backTo}
      backLabel="Back to component"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="replace-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <ReplaceFields part={part} />
        </form>
      </FormProvider>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button type="submit" form="replace-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Save replacement
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function ReplaceFields({ part }: { part: VehicleComponentDetail }) {
  const form = useFormContext<Values>();
  const { control } = form;
  const { errors } = form.formState;
  const values = useWatch({ control });
  const providers = useProviders().data ?? [];

  const date = (name: "date" | "warrantyUntil", label: string, pastOnly: boolean) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional={name !== "date"}
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
    name: "odometerKm" | "expectedLifeKm" | "expectedLifeMonths" | "warrantyKm",
    label: string,
    suffix: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <NumberInput {...field} suffix={suffix} placeholder="0" />}
    />
  );
  const lasted = [
    part.life?.monthsUsed != null && `${formatNumber(part.life.monthsUsed)} months`,
    part.life?.kmUsed != null && formatDistance(part.life.kmUsed),
  ].filter(Boolean);

  return (
    <>
      <p className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm lg:col-span-12">
        <Info className="size-4 shrink-0 text-primary" aria-hidden />
        The old part is kept in its history; schedules watching it restart from this date.
      </p>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={errors.root?.server?.message} />
        <FormSection step={1} title="Replacement">
          <div className="grid gap-4 sm:grid-cols-2">
            {date("date", "Date", true)}
            {number("odometerKm", "Odometer", "km")}
            <div className="sm:col-span-2">
              <FormField
                control={control}
                name="providerName"
                label="Workshop"
                optional
                render={(field) => (
                  <>
                    <Input {...field} list="replace-workshops" autoComplete="off" maxLength={120} />
                    <datalist id="replace-workshops">
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.name} />
                      ))}
                    </datalist>
                  </>
                )}
              />
            </div>
          </div>
        </FormSection>
        <FormSection step={2} title="New part">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="brand"
              label="Brand"
              optional
              render={(field) => <Input {...field} placeholder="e.g. Amaron Pro" maxLength={60} />}
            />
            <FormField
              control={control}
              name="partNumber"
              label="Part number"
              optional
              render={(field) => <Input {...field} className="font-mono" maxLength={60} />}
            />
            {number("expectedLifeKm", "Expected life", "km")}
            {number("expectedLifeMonths", "and/or", "months")}
            {date("warrantyUntil", "Warranty until", false)}
            {number("warrantyKm", "Warranty up to", "km")}
          </div>
        </FormSection>
        <FormSection step={3} title="Cost">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="totalAmount"
              label="Total"
              optional
              render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
            />
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
            Logged as a Component replacement service record; its cost goes to Expenses. ₹0 creates
            no expense.
          </p>
        </FormSection>
        <FormSection step={4} title="Notes">
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => <Textarea {...field} rows={3} maxLength={500} />}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
        <h2 className="font-heading text-lg font-semibold">Summary</h2>
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3.5 text-sm">
          <p>
            <span className="font-medium">{[part.brand, part.name].filter(Boolean).join(" ")}</span>
            <span className="block text-muted-foreground">
              {[
                part.installedAt && `fitted ${formatDate(part.installedAt)}`,
                lasted.length && `lasted ${lasted.join(" / ")}`,
              ]
                .filter(Boolean)
                .join(" · ") || "Fit date not recorded"}
            </span>
          </p>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <p className="font-medium">
            {[values.brand, values.partNumber].filter(Boolean).join(" ") || "New part"}
          </p>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Restarts</dt>
            <dd className="text-right font-medium">
              {part.schedules.length
                ? part.schedules.map((schedule) => schedule.name).join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex items-baseline justify-between gap-2 border-t pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {formatCurrency(values.totalAmount ? values.totalAmount.replace(/,/g, "") : "0")}
          </span>
        </div>
      </aside>
    </>
  );
}
