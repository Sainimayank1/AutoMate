import {
  FUEL_UNIT,
  type FuelEntry,
  FUELS_FOR_VEHICLE,
  fuelTotal,
  PaymentMethod,
  type Vehicle,
} from "@automate/shared";
import { useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { FUEL_TYPE_LABELS, vehicleName } from "@/features/garage/constants";
import { formatDate, formatDistance, formatRegistration } from "@/utils/format";

import { type FuelFormValues, toLocalDateTime } from "./fuel-form-model";
import { LocationField } from "./location-field";

type FuelEntryFieldsProps = {
  /** The vehicle the entry is for (follows the vehicle select when adding). */
  vehicle: Vehicle;
  /** Adding: the vehicles to choose from. Editing: omitted, the vehicle is fixed. */
  vehicles?: Vehicle[];
  /** The vehicle's fill-ups, for the last reading and recent stations. */
  history: FuelEntry[];
  /** Editing: the entry itself, left out of "last reading". */
  editingId?: string;
};

const isAmount = (value: string) => /^\d+(\.\d+)?$/.test(value) && /[1-9]/.test(value);

/**
 * Fields of Stitch "Add Fuel" / "Edit Fill-up". Additions from MODULES.md M3: the automatic
 * location, notes and "missed a fill-up" (keeps mileage honest). Deviation: the total is editable, pre-filled with
 * quantity × price, because the amount paid can differ by pump rounding. Receipt photos wait for
 * file storage (Documents, M6).
 */
export function FuelEntryFields({ vehicle, vehicles, history, editingId }: FuelEntryFieldsProps) {
  const { control, getValues, setValue, formState } = useFormContext<FuelFormValues>();
  const fuelType = useWatch({ control, name: "fuelType" });
  const unit = FUEL_UNIT[fuelType];
  // Once the amount paid is typed in, quantity and price stop overwriting it.
  const totalTyped = useRef(false);

  const fillTotal = () => {
    if (totalTyped.current) return;
    const { quantity, pricePerUnit } = getValues();
    setValue(
      "totalAmount",
      isAmount(quantity) && isAmount(pricePerUnit) ? fuelTotal(quantity, pricePerUnit) : "",
      { shouldDirty: true, shouldValidate: formState.isSubmitted },
    );
  };

  const last = history.find((entry) => entry.id !== editingId);
  const stations = [
    ...new Set(history.map((entry) => entry.stationName).filter((name) => name !== null)),
  ].slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {vehicles && (
          <FormField
            control={control}
            name="vehicleId"
            label="Vehicle"
            render={(field) => (
              <Select
                value={field.value}
                onValueChange={(id) => {
                  field.onChange(id);
                  const next = vehicles.find((item) => item.id === id);
                  if (next) setValue("fuelType", FUELS_FOR_VEHICLE[next.fuelType][0]);
                }}
              >
                <SelectTrigger
                  ref={field.ref}
                  id={field.id}
                  aria-invalid={field["aria-invalid"]}
                  className="w-full data-[size=default]:h-10"
                >
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {vehicleName(item)} ({formatRegistration(item.registrationNumber)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
        <FormField
          control={control}
          name="filledAt"
          label="Date & time"
          render={(field) => (
            <Input
              {...field}
              type="datetime-local"
              max={toLocalDateTime(new Date())}
              className="h-10 font-mono tabular-nums"
            />
          )}
        />
        <FormField
          control={control}
          name="odometerKm"
          label="Odometer reading"
          description={
            last
              ? `Last reading: ${formatDistance(last.odometerKm)} on ${formatDate(last.filledAt)}`
              : `Vehicle odometer: ${formatDistance(vehicle.odometerKm)}`
          }
          render={(field) => <NumberInput {...field} suffix="km" placeholder="8,450" />}
        />
        <FormField
          control={control}
          name="fuelType"
          label="Fuel type"
          render={(field) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                className="w-full data-[size=default]:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUELS_FOR_VEHICLE[vehicle.fuelType].map((value) => (
                  <SelectItem key={value} value={value}>
                    {FUEL_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Quantity × price = total */}
      <div className="grid gap-4 rounded-lg border bg-muted p-4 sm:grid-cols-3">
        <FormField
          control={control}
          name="quantity"
          label={`Quantity (${unit})`}
          render={(field) => (
            <NumberInput
              {...field}
              onChange={(value) => {
                field.onChange(value);
                fillTotal();
              }}
              suffix={unit}
              decimals={3}
              placeholder="32.4"
            />
          )}
        />
        <FormField
          control={control}
          name="pricePerUnit"
          label={`Price per ${unit}`}
          render={(field) => (
            <NumberInput
              {...field}
              onChange={(value) => {
                field.onChange(value);
                fillTotal();
              }}
              prefix="₹"
              decimals={3}
              placeholder="104.32"
            />
          )}
        />
        <FormField
          control={control}
          name="totalAmount"
          label="Total amount"
          description="Quantity × price. Change it to what you paid."
          render={(field) => (
            <NumberInput
              {...field}
              onChange={(value) => {
                totalTyped.current = value !== "";
                field.onChange(value);
              }}
              prefix="₹"
              decimals={2}
              placeholder="3,380"
            />
          )}
        />
      </div>

      <FormField
        control={control}
        name="isFullTank"
        label="Tank fill type"
        render={(field) => (
          <RadioGroup
            value={field.value ? "full" : "partial"}
            onValueChange={(value) => field.onChange(value === "full")}
            aria-labelledby={`${field.id}-label`}
            className="grid gap-3 sm:grid-cols-2"
          >
            {[
              { value: "full", title: "Full tank", hint: "Calculates exact mileage" },
              { value: "partial", title: "Partial tank", hint: "Rolls into the next full tank" },
            ].map((option) => (
              <FieldLabel
                key={option.value}
                htmlFor={`tank-${option.value}`}
                className="has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary dark:has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-secondary"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem value={option.value} id={`tank-${option.value}`} />
                  <FieldContent>
                    <FieldTitle>{option.title}</FieldTitle>
                    <FieldDescription>{option.hint}</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        )}
      />

      <Controller
        control={control}
        name="missedPrevious"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              ref={field.ref}
              id="fuel-missed-previous"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
            />
            <FieldContent>
              <FieldLabel htmlFor="fuel-missed-previous">
                I didn&apos;t log a fill-up before this one
              </FieldLabel>
              <FieldDescription>
                Mileage restarts here, so it isn&apos;t overstated.
              </FieldDescription>
            </FieldContent>
          </Field>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="stationName"
          label="Fuel station"
          optional
          render={(field) => (
            <>
              <Input
                {...field}
                list="fuel-station-suggestions"
                autoComplete="off"
                placeholder="IndianOil COCO, Sector 29"
                className="h-10"
              />
              <datalist id="fuel-station-suggestions">
                {stations.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </>
          )}
        />
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
                aria-invalid={field["aria-invalid"]}
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
        <LocationField capture={!editingId} />
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(field) => (
            <Textarea {...field} rows={1} placeholder="Highway run, AC on" className="min-h-10" />
          )}
        />
      </div>
    </div>
  );
}
