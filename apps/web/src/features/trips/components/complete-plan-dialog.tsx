import { istToday, tripDistance, type TripPlan } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";
import {
  completePlanForm,
  type CompletePlanFormValues,
  type CompletePlanOutput,
  completePlanSchema,
} from "@/features/trips/components/complete-plan-form-model";
import { useCompleteTripPlan } from "@/features/trips/hooks/use-trip-plans";
import { applyServerErrors } from "@/lib/forms";
import { formatDistance } from "@/utils/format";

const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : "");

/**
 * Stitch "Mark Trip Done Dialog": the plan happened. Enter what actually did (odometer readings,
 * an entered distance, or the planned route as driven); the plan's places, type and notes carry
 * over and its figures stay beside the actual ones. Saving opens the done trip.
 */
export function CompletePlanDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: TripPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {/* Mounted per opening, so the form starts from the plan and odometer as they are then. */}
        <CompleteForm plan={plan} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CompleteForm({ plan, onClose }: { plan: TripPlan; onClose: () => void }) {
  const navigate = useNavigate();
  const complete = useCompleteTripPlan(plan.id);
  const vehicle = useVehicles().data?.find((item) => item.id === plan.vehicleId);
  const form = useForm<CompletePlanFormValues, unknown, CompletePlanOutput>({
    resolver: zodResolver(completePlanSchema) as unknown as Resolver<
      CompletePlanFormValues,
      unknown,
      CompletePlanOutput
    >,
    defaultValues: completePlanForm(plan, istToday(new Date()), vehicle?.odometerKm),
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const trip = await complete.mutateAsync(values);
      onClose();
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Mark trip as done</DialogTitle>
          <DialogDescription>
            Enter what actually happened. The plan&apos;s budget stays for comparison.
          </DialogDescription>
        </DialogHeader>
        <FormError message={form.formState.errors.root?.server?.message} />
        <CompleteFields plan={plan} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
            Mark as done
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

function CompleteFields({ plan }: { plan: TripPlan }) {
  const { control } = useFormContext<CompletePlanFormValues>();
  const values = useWatch({ control });
  const methods = [
    { value: "ODOMETER" as const, label: "Odometer" },
    { value: "DISTANCE" as const, label: "Distance" },
    ...(plan.route ? [{ value: "ROUTE" as const, label: "As planned" }] : []),
  ];
  const toNumber = (value?: string) => (value ? Number(value.replace(/,/g, "")) : null);
  const distance =
    values.method === "ROUTE"
      ? plan.plannedDistanceKm
      : tripDistance({
          method: values.method ?? "ODOMETER",
          startKm: toNumber(values.startKm),
          endKm: toNumber(values.endKm),
          distanceKm: values.distanceKm?.replace(/,/g, "") || null,
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
          disabledDates={{ after: new Date() }}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={control}
        name="method"
        label="How do you know the distance?"
        render={(field) => (
          <Segmented
            value={field.value}
            options={methods}
            onChange={field.onChange}
            aria-labelledby={`${field.id}-label`}
            className="w-full *:flex-1"
          />
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {date("date", "Date", false)}
        {date("endDate", "End date", true)}
        <FormField
          control={control}
          name="startTime"
          label="Start time"
          optional
          render={(field) => <Input {...field} type="time" />}
        />
        <FormField
          control={control}
          name="endTime"
          label="End time"
          optional
          render={(field) => <Input {...field} type="time" />}
        />
        {values.method === "ODOMETER" && (
          <>
            <FormField
              control={control}
              name="startKm"
              label="Starting odometer"
              render={(field) => <NumberInput {...field} suffix="km" placeholder="0" />}
            />
            <FormField
              control={control}
              name="endKm"
              label="Ending odometer"
              render={(field) => <NumberInput {...field} suffix="km" placeholder="0" />}
            />
          </>
        )}
        {values.method === "DISTANCE" && (
          <FormField
            control={control}
            name="distanceKm"
            label="Distance"
            render={(field) => <NumberInput {...field} suffix="km" decimals={1} placeholder="0" />}
          />
        )}
      </div>
      <p className="text-sm">
        {values.method === "ROUTE" ? "The planned route: " : "Actual distance: "}
        <span className="font-medium tabular-nums">
          {distance ? formatDistance(distance) : "—"}
        </span>
        {plan.plannedDistanceKm && values.method !== "ROUTE" && (
          <span className="text-muted-foreground">
            {" "}
            (planned {formatDistance(plan.plannedDistanceKm)})
          </span>
        )}
      </p>
    </div>
  );
}
