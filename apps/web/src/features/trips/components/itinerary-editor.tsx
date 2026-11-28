import {
  checkItinerary,
  stayMinutes,
  stopDays,
  tripDays,
  tripItinerary,
  type TripStop,
  tripStopSchema,
  type UpdateTripValues,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Moon } from "lucide-react";
import { useMemo } from "react";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

import { FormError } from "@/components/common/form-error";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { durationText } from "@/features/trips/utils/trip-text";
import { applyServerErrors } from "@/lib/forms";
import { formatDate, formatNumber } from "@/utils/format";

type StopFields = {
  day: number;
  overnight: boolean;
  arrivalTime: string;
  departureTime: string;
  notes: string;
};
type FormValues = { stops: StopFields[] };
const fields = z.object({
  stops: z.array(
    tripStopSchema.pick({
      day: true,
      overnight: true,
      arrivalTime: true,
      departureTime: true,
      notes: true,
    }),
  ),
});
type Output = z.output<typeof fields>;

/** The trip or plan being laid out; its places, dates and route stay as they are. */
export type ItineraryTrip = {
  label: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  origin: string | null;
  destination: string | null;
  stops: TripStop[];
  /** e.g. "1,080 km planned". */
  distanceText: string | null;
};

const weekdayDate = (date: string) =>
  `${new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}, ${formatDate(date)}`;

/**
 * Stitch "Road Trip Itinerary — Desktop / Mobile": which day each stop falls on, stay times and
 * where each night is spent. Places and their order belong to Edit (and the route), not here.
 */
export function ItineraryEditor({
  trip,
  backTo,
  onSave,
}: {
  trip: ItineraryTrip;
  backTo: string;
  onSave: (stops: NonNullable<UpdateTripValues["stops"]>) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const days = tripDays(trip.date, trip.endDate);
  const schema = useMemo(
    () =>
      fields.superRefine((values, ctx) =>
        checkItinerary({ date: trip.date, endDate: trip.endDate, stops: values.stops }, ctx),
      ),
    [trip.date, trip.endDate],
  );
  const resolved = stopDays(trip.stops);
  const form = useForm<FormValues, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues, unknown, Output>,
    defaultValues: {
      stops: trip.stops.map((stop, index) => ({
        day: Math.min(resolved[index]!, days),
        overnight: stop.overnight,
        arrivalTime: stop.arrivalTime ?? "",
        departureTime: stop.departureTime ?? "",
        notes: stop.notes ?? "",
      })),
    },
  });
  const { isDirty, isSubmitting, errors } = form.formState;
  const values = useWatch({ control: form.control, name: "stops" });
  const itinerary = tripItinerary({
    ...trip,
    stops: trip.stops.map((stop, index) => ({ ...stop, ...values[index], index })),
  });
  const nights = itinerary.filter((day) => day.night);

  const submit = form.handleSubmit(async (output) => {
    try {
      await onSave(
        trip.stops.map(({ label, latitude, longitude }, index) => ({
          label,
          latitude,
          longitude,
          ...output.stops[index]!,
        })),
      );
      navigate(backTo, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <TaskPage
      title="Itinerary"
      subtitle={`${trip.label} · ${days} ${days === 1 ? "day" : "days"}`}
      backTo={backTo}
      backLabel="Back"
      closeOnMobile
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <form
        id="itinerary-form"
        noValidate
        onSubmit={submit}
        className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
      >
        <div className="flex flex-col gap-5 lg:col-span-8">
          <FormError message={errors.root?.server?.message} />
          {itinerary.map((day) => (
            <section
              key={day.day}
              aria-label={`Day ${day.day}`}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-heading font-medium tabular-nums">
                  <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                  Day {day.day} · {weekdayDate(day.date)}
                  {day.from && (
                    <span className="font-normal text-muted-foreground">
                      · from {day.from}
                      {day.day === 1 && trip.startTime && ` ${trip.startTime}`}
                    </span>
                  )}
                </h2>
                {day.night && (
                  <Badge variant="secondary">
                    <Moon data-icon="inline-start" aria-hidden />
                    Night at {day.night}
                  </Badge>
                )}
              </div>
              {day.stops.length === 0 && (
                <p className="text-sm text-muted-foreground">No stops this day.</p>
              )}
              {day.stops.map((stop) => (
                <StopRow
                  key={stop.id}
                  index={stop.index}
                  label={stop.label}
                  days={days}
                  stay={stayMinutes(values[stop.index] ?? {})}
                  form={form}
                />
              ))}
              {day.to && <p className="text-sm text-muted-foreground">Ends at {day.to}</p>}
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
          <h2 className="font-heading text-lg font-medium">Summary</h2>
          <div>
            <p className="font-heading text-2xl font-medium tabular-nums">
              {days} {days === 1 ? "day" : "days"} · {nights.length}{" "}
              {nights.length === 1 ? "night" : "nights"}
            </p>
            <p className="text-sm text-muted-foreground">
              {[trip.origin, ...trip.stops.map((stop) => stop.label), trip.destination]
                .filter(Boolean)
                .join(" → ")}
            </p>
          </div>
          {nights.length > 0 && (
            <ul className="flex flex-col gap-2 border-t pt-3 text-sm" aria-label="Nights">
              {nights.map((day) => (
                <li key={day.day} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Moon className="size-4 text-muted-foreground" aria-hidden />
                    {day.night}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Day {day.day} · {formatDate(day.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <dl className="flex flex-col gap-2 border-t pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Stops</dt>
              <dd className="font-medium tabular-nums">{formatNumber(trip.stops.length)}</dd>
            </div>
            {trip.distanceText && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Distance</dt>
                <dd className="font-medium tabular-nums">{trip.distanceText}</dd>
              </div>
            )}
          </dl>
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Reorder or add places in Edit; here you set the days, stay times and nights.
          </p>
        </aside>
      </form>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button type="submit" form="itinerary-form" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Save itinerary
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function StopRow({
  index,
  label,
  days,
  stay,
  form,
}: {
  index: number;
  label: string;
  days: number;
  stay: number | null;
  form: ReturnType<typeof useForm<FormValues, unknown, Output>>;
}) {
  const id = `stop-${index}`;
  const stopErrors = form.formState.errors.stops?.[index];
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {label}
          {stay !== null && <Badge variant="outline">stayed {durationText(stay)}</Badge>}
        </span>
        <span className="flex items-center gap-4">
          <Controller
            control={form.control}
            name={`stops.${index}.day`}
            render={({ field }) => (
              <span className="flex items-center gap-2">
                <Label htmlFor={`${id}-day`} className="text-xs">
                  Day
                </Label>
                <Select
                  value={String(field.value)}
                  onValueChange={(day) => field.onChange(Number(day))}
                >
                  <SelectTrigger
                    id={`${id}-day`}
                    size="sm"
                    aria-label={`Day for ${label}`}
                    aria-invalid={!!stopErrors?.day}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: days }, (_, day) => (
                      <SelectItem key={day} value={String(day + 1)}>
                        Day {day + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            )}
          />
          <Controller
            control={form.control}
            name={`stops.${index}.overnight`}
            render={({ field }) => (
              <span className="flex items-center gap-2">
                <Switch
                  id={`${id}-overnight`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-invalid={!!stopErrors?.overnight}
                />
                <Label htmlFor={`${id}-overnight`} className="text-xs">
                  Overnight
                </Label>
              </span>
            )}
          />
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-arrival`} className="text-xs">
            Arrived (optional)
          </Label>
          <Input
            id={`${id}-arrival`}
            type="time"
            {...form.register(`stops.${index}.arrivalTime`)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-departure`} className="text-xs">
            Left (optional)
          </Label>
          <Input
            id={`${id}-departure`}
            type="time"
            {...form.register(`stops.${index}.departureTime`)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-notes`} className="text-xs">
            Notes (optional)
          </Label>
          <Input id={`${id}-notes`} maxLength={300} {...form.register(`stops.${index}.notes`)} />
        </div>
      </div>
      <FieldError
        errors={[
          stopErrors?.day,
          stopErrors?.overnight,
          stopErrors?.arrivalTime,
          stopErrors?.departureTime,
        ]}
      />
    </div>
  );
}
