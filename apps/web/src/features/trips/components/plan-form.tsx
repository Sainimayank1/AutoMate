import { FUEL_UNIT, planBudget, type TripPlan, type Vehicle } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Settings2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Badge } from "@/components/ui/badge";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFuelSummary } from "@/features/fuel/hooks/use-fuel";
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import {
  type PlanFormOutput,
  planFormSchema,
  type PlanFormValues,
} from "@/features/trips/components/plan-form-model";
import { PlacesFields, RoutePreview } from "@/features/trips/components/trip-places";
import { TripTypesDialog } from "@/features/trips/components/trip-types-dialog";
import { useTripCategories } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate, formatDistance, formatNumber } from "@/utils/format";

const METHODS = [
  { value: "DISTANCE" as const, label: "Enter distance" },
  { value: "ROUTE" as const, label: "Plan a route" },
];
const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : "");
const plain = (value?: string) => value?.replace(/,/g, "") || null;

/**
 * Stitch "Plan Trip — Desktop / Mobile": where and when, the planned distance (entered or the
 * provider's route) and the budget's assumptions, with the estimate beside it. A draft can be
 * saved half-done; nothing here counts as distance or spending.
 */
export function PlanForm({
  plan,
  vehicles,
  defaultValues,
  backTo,
  onSave,
}: {
  /** Editing: the plan as stored. */
  plan?: TripPlan;
  vehicles: Vehicle[];
  defaultValues: PlanFormValues;
  backTo: string;
  onSave: (values: PlanFormOutput) => Promise<TripPlan>;
}) {
  const navigate = useNavigate();
  const form = useForm<PlanFormValues, unknown, PlanFormOutput>({
    resolver: zodResolver(planFormSchema) as unknown as Resolver<
      PlanFormValues,
      unknown,
      PlanFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;
  const [saving, setSaving] = useState<"DRAFT" | "PLANNED" | null>(null);
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const draft = !plan || plan.status === "DRAFT";

  const submit = (status: "DRAFT" | "PLANNED") =>
    form.handleSubmit(async (output) => {
      setSaving(status);
      try {
        const saved = await onSave({ ...output, status });
        navigate(`/trips/planner/${saved.id}`, { replace: true, state: { savedChanges: true } });
      } catch (error) {
        applyServerErrors(form.setError, error);
        const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
        if (field) form.setFocus(field as keyof PlanFormValues);
      } finally {
        setSaving(null);
      }
    });

  return (
    <TaskPage
      title={plan ? "Edit plan" : "Plan a trip"}
      subtitle={vehicle && vehicleName(vehicle)}
      backTo={backTo}
      backLabel="Back"
      closeOnMobile
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="plan-form"
          noValidate
          onSubmit={(event) => void submit("PLANNED")(event)}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <PlanFields creating={!plan} vehicles={vehicles} storedRoute={plan?.route} />
        </form>
      </FormProvider>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
        {draft && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => void submit("DRAFT")()}
          >
            {saving === "DRAFT" && <Spinner data-icon="inline-start" />}
            {plan ? "Save draft" : "Save as draft"}
          </Button>
        )}
        <Button
          type="submit"
          form="plan-form"
          disabled={isSubmitting || (!!plan && !draft && !isDirty)}
        >
          {saving === "PLANNED" && <Spinner data-icon="inline-start" />}
          {plan && !draft ? "Save changes" : "Save plan"}
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function PlanFields({
  creating,
  vehicles,
  storedRoute,
}: {
  creating: boolean;
  vehicles: Vehicle[];
  storedRoute?: TripPlan["route"];
}) {
  const form = useFormContext<PlanFormValues>();
  const { control } = form;
  const values = useWatch({ control });
  const categories = (useTripCategories().data ?? []).filter(
    (category) => !category.archivedAt || category.id === values.categoryId,
  );
  const [managing, setManaging] = useState(false);
  const [routeMinutes, setRouteMinutes] = useState(storedRoute?.durationMinutes ?? null);
  const fuel = useFuelSummary(values.vehicleId).data;
  const unit = fuel ? FUEL_UNIT[fuel.fuelType] : "L";
  const routed = values.method === "ROUTE";
  const category = categories.find((item) => item.id === values.categoryId);
  const places = [
    values.origin,
    ...(values.stops ?? []).map((stop) => stop.label),
    values.destination,
  ].filter(Boolean);
  const budget = planBudget({
    plannedDistanceKm: plain(values.plannedDistanceKm),
    estMileage: plain(values.estMileage),
    estFuelPrice: plain(values.estFuelPrice),
    estToll: plain(values.estToll),
    estParking: plain(values.estParking),
    estAccommodation: plain(values.estAccommodation),
    estOther: plain(values.estOther),
  });

  const date = (name: "date" | "endDate", label: string, optional: boolean) => (
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
          onChange={(next) => {
            field.onChange(iso(next));
            field.onBlur();
          }}
          placeholder="DD/MM/YYYY"
        />
      )}
    />
  );
  const money = (
    name: "estToll" | "estParking" | "estAccommodation" | "estOther",
    label: string,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormSection step={1} title="Trip">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="vehicleId"
              label="Vehicle"
              description={creating ? undefined : "A plan stays with its vehicle"}
              render={(field) => (
                <Select value={field.value} disabled={!creating} onValueChange={field.onChange}>
                  <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {vehicleName(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={control}
              name="title"
              label="Title"
              optional
              render={(field) => (
                <Input {...field} placeholder="e.g. Manali road trip" maxLength={80} />
              )}
            />
          </div>
          <FormField
            control={control}
            name="categoryId"
            label="Trip type"
            render={(field) => (
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={field.value}
                  onValueChange={(id) => id && field.onChange(id)}
                  aria-labelledby={`${field.id}-label`}
                  aria-invalid={field["aria-invalid"]}
                  spacing={2}
                  className="flex-wrap"
                >
                  {categories.map((item) => (
                    <ToggleGroupItem
                      key={item.id}
                      value={item.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                    >
                      {item.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Manage trip types"
                  onClick={() => setManaging(true)}
                >
                  <Settings2 />
                </Button>
              </div>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {date("date", "Departure date", false)}
            <FormField
              control={control}
              name="startTime"
              label="Start time"
              optional
              render={(field) => <Input {...field} type="time" />}
            />
            {date("endDate", "Return date", true)}
          </div>
        </FormSection>

        <FormSection
          step={2}
          title="Route"
          aside={
            <Segmented
              value={values.method ?? "DISTANCE"}
              options={METHODS}
              onChange={(method) => form.setValue("method", method, { shouldDirty: true })}
              aria-label="Planned distance"
            />
          }
        >
          <PlacesFields />
          {routed ? (
            <RoutePreview
              stored={storedRoute}
              onChoose={(route) => {
                form.setValue("plannedDistanceKm", route.distanceKm);
                setRouteMinutes(route.durationMinutes);
              }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="plannedDistanceKm"
                label="Distance"
                optional
                description="Your estimate, both ways if you're coming back"
                render={(field) => (
                  <NumberInput {...field} suffix="km" decimals={1} placeholder="0" />
                )}
              />
            </div>
          )}
        </FormSection>

        <FormSection step={3} title="Budget">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="estMileage"
              label="Mileage"
              optional
              description={
                fuel?.averageMileage
                  ? `From your full tanks: ${formatNumber(Number(fuel.averageMileage))} km/${unit}`
                  : undefined
              }
              render={(field) => (
                <NumberInput {...field} suffix={`km/${unit}`} decimals={2} placeholder="0" />
              )}
            />
            <FormField
              control={control}
              name="estFuelPrice"
              label="Fuel price"
              optional
              render={(field) => (
                <NumberInput
                  {...field}
                  prefix="₹"
                  suffix={`per ${unit}`}
                  decimals={2}
                  placeholder="0"
                />
              )}
            />
          </div>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {money("estToll", "Toll")}
            {money("estParking", "Parking")}
            {money("estAccommodation", "Stay")}
            {money("estOther", "Other")}
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Budget estimate</h2>
          {category && <Badge variant="secondary">{category.name}</Badge>}
        </div>
        <div className="flex flex-col gap-1 border-b pb-3">
          <p className="font-heading text-3xl font-semibold tabular-nums">
            {budget.total ? formatCurrency(budget.total) : "—"}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {[
              places.join(" → "),
              values.date &&
                `${formatDate(values.date)}${values.endDate ? ` – ${formatDate(values.endDate)}` : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryRow
            label={
              budget.fuelQuantity
                ? `Fuel ${formatNumber(Number(budget.fuelQuantity))} ${unit}`
                : "Fuel"
            }
          >
            {budget.fuelCost
              ? formatCurrency(budget.fuelCost)
              : "Needs distance, mileage and price"}
          </SummaryRow>
          {(
            [
              ["Toll", values.estToll],
              ["Parking", values.estParking],
              ["Stay", values.estAccommodation],
              ["Other", values.estOther],
            ] as const
          ).map(
            ([label, value]) =>
              plain(value) && (
                <SummaryRow key={label} label={label}>
                  {formatCurrency(plain(value)!)}
                </SummaryRow>
              ),
          )}
        </dl>
        <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm font-medium tabular-nums">
          <span className="text-primary">
            {budget.perKm ? `${formatCurrency(budget.perKm)} per km` : "— per km"}
          </span>
          <span className="text-muted-foreground">
            {plain(values.plannedDistanceKm)
              ? `${formatDistance(plain(values.plannedDistanceKm)!)} planned`
              : routed
                ? "Calculate the route"
                : "No distance yet"}
            {routed && routeMinutes !== null && ` · ${durationText(routeMinutes)}`}
          </span>
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Estimates only. Nothing is added to expenses until the trip is done.
        </p>
      </aside>
      <TripTypesDialog open={managing} onOpenChange={setManaging} />
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
