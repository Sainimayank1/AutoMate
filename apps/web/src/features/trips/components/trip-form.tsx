import {
  type Trip,
  TRIP_DAY_KM_NOTICE,
  tripDistance,
  tripDurationMinutes,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { CircleAlert, Settings2 } from "lucide-react";
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
import { vehicleName } from "@/features/garage/constants";
import { FormSection } from "@/features/maintenance/components/form-section";
import {
  type TripFormOutput,
  tripFormSchema,
  type TripFormValues,
} from "@/features/trips/components/trip-form-model";
import { PlacesFields, RoutePreview } from "@/features/trips/components/trip-places";
import { TripTypesDialog } from "@/features/trips/components/trip-types-dialog";
import { METHOD_LABELS } from "@/features/trips/constants";
import { useTripCategories } from "@/features/trips/hooks/use-trips";
import { durationText } from "@/features/trips/utils/trip-text";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatDate, formatDistance, formatNumber } from "@/utils/format";

const METHODS = [
  { value: "ODOMETER" as const, label: "Odometer" },
  { value: "DISTANCE" as const, label: "Distance" },
  { value: "ROUTE" as const, label: "Route" },
];
const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : "");

/**
 * Stitch "Log Trip Form — Desktop / Mobile" (and its edit variant): the vehicle, how the distance
 * is known (two odometer readings, or entered), the type, when and where. Saving opens the trip.
 * The vehicle can't change on edit (its readings belong to that vehicle's history).
 */
export function TripForm({
  mode,
  vehicles,
  defaultValues,
  storedRoute,
  backTo,
  onSave,
}: {
  mode: "create" | "edit";
  vehicles: Vehicle[];
  defaultValues: TripFormValues;
  /** Editing a route trip: the route it was measured on. */
  storedRoute?: Trip["route"];
  backTo: string;
  onSave: (values: TripFormOutput) => Promise<Trip>;
}) {
  const navigate = useNavigate();
  const form = useForm<TripFormValues, unknown, TripFormOutput>({
    resolver: zodResolver(tripFormSchema) as unknown as Resolver<
      TripFormValues,
      unknown,
      TripFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;
  const creating = mode === "create";
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const vehicle = vehicles.find((item) => item.id === vehicleId);

  const submit = form.handleSubmit(async (output) => {
    try {
      const saved = await onSave(output);
      navigate(`/trips/${saved.id}`, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof TripFormValues);
    }
  });

  return (
    <TaskPage
      title={creating ? "Log trip" : "Edit trip"}
      subtitle={vehicle && `${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
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
          id="trip-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <TripFields creating={creating} vehicles={vehicles} storedRoute={storedRoute} />
        </form>
      </FormProvider>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button type="submit" form="trip-form" disabled={isSubmitting || (!creating && !isDirty)}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {creating ? "Save trip" : "Save changes"}
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function TripFields({
  creating,
  vehicles,
  storedRoute,
}: {
  creating: boolean;
  vehicles: Vehicle[];
  storedRoute?: Trip["route"];
}) {
  const form = useFormContext<TripFormValues>();
  const { control } = form;
  const values = useWatch({ control });
  const categories = (useTripCategories().data ?? []).filter(
    (category) => !category.archivedAt || category.id === values.categoryId,
  );
  const [managing, setManaging] = useState(false);
  const vehicle = vehicles.find((item) => item.id === values.vehicleId);
  const odometer = values.method === "ODOMETER";
  const routed = values.method === "ROUTE";

  const toNumber = (value?: string) => (value ? Number(value.replace(/,/g, "")) : null);
  const distance = tripDistance({
    method: values.method,
    startKm: toNumber(values.startKm),
    endKm: toNumber(values.endKm),
    distanceKm: values.distanceKm?.replace(/,/g, "") || null,
  });
  const duration = tripDurationMinutes(values);
  const days =
    values.date && values.endDate
      ? Math.max(1, (Date.parse(values.endDate) - Date.parse(values.date)) / 86_400_000 + 1)
      : 1;
  const unusual = distance !== null && Number(distance) / days > TRIP_DAY_KM_NOTICE;
  const category = categories.find((item) => item.id === values.categoryId);

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
          disabledDates={{ after: new Date() }}
        />
      )}
    />
  );
  const time = (name: "startTime" | "endTime", label: string) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <Input {...field} type="time" />}
    />
  );
  const reading = (name: "startKm" | "endKm", label: string, description?: string) => (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      render={(field) => <NumberInput {...field} suffix="km" placeholder="0" />}
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
              description={creating ? undefined : "A trip stays with its vehicle"}
              render={(field) => (
                <Select
                  value={field.value}
                  disabled={!creating}
                  onValueChange={(id) => {
                    // A start reading still matching the old vehicle follows the new one.
                    const old = vehicles.find((item) => item.id === field.value);
                    const next = vehicles.find((item) => item.id === id);
                    const start = form.getValues("startKm");
                    if (!start || (old && toNumber(start) === old.odometerKm)) {
                      form.setValue("startKm", next ? String(next.odometerKm) : "", {
                        shouldDirty: true,
                      });
                    }
                    field.onChange(id);
                  }}
                >
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
              name="method"
              label="How do you know the distance?"
              render={(field) => (
                <Segmented
                  value={field.value}
                  options={METHODS}
                  onChange={field.onChange}
                  aria-labelledby={`${field.id}-label`}
                  className="w-full *:flex-1"
                />
              )}
            />
            <FormField
              control={control}
              name="categoryId"
              label="Trip type"
              render={(field) => (
                <div className="flex items-center gap-2">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      ref={field.ref}
                      id={field.id}
                      aria-invalid={field["aria-invalid"]}
                      onBlur={field.onBlur}
                      className="w-full"
                    >
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Manage trip types"
                    onClick={() => setManaging(true)}
                  >
                    <Settings2 />
                  </Button>
                </div>
              )}
            />
            <FormField
              control={control}
              name="title"
              label="Title"
              optional
              render={(field) => (
                <Input {...field} placeholder="e.g. Weekend in Jaipur" maxLength={80} />
              )}
            />
          </div>
        </FormSection>

        <FormSection step={2} title="When">
          <div className="grid gap-4 sm:grid-cols-2">
            {date("date", "Date", false)}
            {date("endDate", "End date", true)}
            {time("startTime", "Start time")}
            {time("endTime", "End time")}
          </div>
        </FormSection>

        <FormSection step={3} title={routed ? "Route" : "Distance"}>
          {routed ? (
            <RoutePreview stored={storedRoute} />
          ) : odometer ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {reading(
                "startKm",
                "Starting odometer",
                vehicle ? `Vehicle odometer: ${formatDistance(vehicle.odometerKm)}` : undefined,
              )}
              {reading("endKm", "Ending odometer")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="distanceKm"
                label="Distance"
                description="Entered distance, not from odometer readings"
                render={(field) => (
                  <NumberInput {...field} suffix="km" decimals={1} placeholder="0" />
                )}
              />
            </div>
          )}
          {odometer && distance !== null && (
            <p className="text-sm">
              Distance <span className="font-medium tabular-nums">{formatDistance(distance)}</span>
            </p>
          )}
          {unusual && (
            <p className="flex items-center gap-1.5 text-sm text-warning" role="status">
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              That&apos;s more than {formatNumber(TRIP_DAY_KM_NOTICE)} km in a day. Check the{" "}
              {odometer ? "readings" : "distance"}.
            </p>
          )}
        </FormSection>

        <FormSection step={4} title="Where">
          <PlacesFields />
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
          <h2 className="font-heading text-lg font-semibold">Summary</h2>
          {category && <Badge variant="secondary">{category.name}</Badge>}
        </div>
        <p className="font-medium">
          {values.title ||
            (values.origin && values.destination
              ? `${values.origin} → ${values.destination}`
              : values.destination || values.origin || "New trip")}
        </p>
        <dl className="flex flex-col gap-2.5 text-sm">
          <SummaryRow label="When">
            {values.date ? formatDate(values.date) : "—"}
            {values.startTime &&
              ` · ${values.startTime}${values.endTime ? ` – ${values.endTime}` : ""}`}
          </SummaryRow>
          <SummaryRow label="Distance">
            {routed ? "From the route" : distance !== null ? formatDistance(distance) : "—"}
          </SummaryRow>
          <SummaryRow label="Measured">{METHOD_LABELS[values.method ?? "ODOMETER"]}</SummaryRow>
          <SummaryRow label="Duration">
            {duration !== null ? durationText(duration) : "Not recorded"}
          </SummaryRow>
          {odometer && values.startKm && values.endKm && (
            <SummaryRow label="Odometer">
              {values.startKm} → {values.endKm} km
            </SummaryRow>
          )}
        </dl>
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
