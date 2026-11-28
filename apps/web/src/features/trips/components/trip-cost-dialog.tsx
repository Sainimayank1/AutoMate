import {
  type CreateTripCostValues,
  PaymentMethod,
  type Trip,
  type TripCost,
  TripCostCategory,
  tripCostFieldsSchema,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
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
import {
  tripCostForm,
  type TripCostFormValues,
} from "@/features/trips/components/trip-cost-form-model";
import { COST_LABELS, isVehicleCost } from "@/features/trips/constants";
import { useSaveTripCost } from "@/features/trips/hooks/use-trips";
import { applyServerErrors } from "@/lib/forms";

const schema = tripCostFieldsSchema.omit({ id: true });
type Output = Omit<CreateTripCostValues, "id">;
const NONE = "none";

/**
 * Stitch "Add Trip Cost Dialog — Desktop": add or edit a trip cost. Toll, parking and other also
 * become the vehicle's expenses; food and accommodation stay with the trip, and the dialog says
 * which.
 */
export function TripCostDialog({
  trip,
  cost,
  open,
  onOpenChange,
}: {
  trip: Trip;
  /** Editing this cost; omitted to add one. */
  cost?: TripCost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveTripCost(trip.id);
  // One id per new cost: a retried save returns the cost it already made.
  const [id, setId] = useState(() => crypto.randomUUID());
  const form = useForm<TripCostFormValues, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<TripCostFormValues, unknown, Output>,
    defaultValues: tripCostForm(trip.date, cost),
  });
  useEffect(() => {
    if (open) form.reset(tripCostForm(trip.date, cost));
  }, [open, cost, trip.date, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(cost ? { id: cost.id, values } : { values: { ...values, id } });
      if (!cost) setId(crypto.randomUUID());
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <FormProvider {...form}>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{cost ? "Edit cost" : "Add cost"}</DialogTitle>
              <DialogDescription>Money spent on this trip</DialogDescription>
            </DialogHeader>
            <FormError message={form.formState.errors.root?.server?.message} />
            <CostFields />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
                Save cost
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

function CostFields() {
  const { control } = useFormContext<TripCostFormValues>();
  const category = useWatch({ control, name: "category" });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="category"
        label="What for"
        description={
          isVehicleCost(category)
            ? "Also added to your vehicle's expenses"
            : "Kept with the trip, not in vehicle expenses"
        }
        render={(field) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger ref={field.ref} id={field.id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(TripCostCategory).map((value) => (
                <SelectItem key={value} value={value}>
                  {COST_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        name="date"
        label="Date"
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
            disabledDates={{ after: new Date() }}
          />
        )}
      />
      <FormField
        control={control}
        name="paymentMethod"
        label="Paid by"
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
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="vendor"
          label="Where"
          optional
          render={(field) => (
            <Input {...field} placeholder="e.g. Kherki Daula plaza" maxLength={120} />
          )}
        />
      </div>
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(field) => <Textarea {...field} rows={2} maxLength={500} />}
        />
      </div>
    </div>
  );
}
