import { FuelType, OwnershipType, Transmission, VehicleCategory } from "@automate/shared";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { CarFront, Search, TriangleAlert, Truck, Van } from "lucide-react";
import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { NumericFormat } from "react-number-format";

import { DatePicker } from "@/components/common/date-picker";
import { FormField } from "@/components/common/form-field";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  MANUFACTURERS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
} from "@/features/garage/constants";
import { formatDistance } from "@/utils/format";

import type { VehicleFormValues } from "./vehicle-form-model";

/**
 * Field sections shared by the add wizard (Stitch "Add Vehicle" steps 1–4) and the edit page.
 * `compact` (edit page, Stitch "Edit Vehicle"): category, fuel and ownership as selects, not cards.
 */
type SectionProps = { compact?: boolean };

// ---------------------------------------------------------------- sections

const yearPlaceholder = String(new Date().getFullYear());
const CATEGORY_ICONS = {
  [VehicleCategory.MUV]: Van,
  [VehicleCategory.OTHER]: Truck,
} as Partial<Record<VehicleCategory, typeof CarFront>>;

export function BasicDetailsFields({ compact }: SectionProps) {
  const { control } = useFormContext<VehicleFormValues>();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="make"
        label="Manufacturer"
        render={(field) => (
          // Free text with suggestions: any make can be typed, common ones are a tap away.
          <InputGroup className="h-10">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              {...field}
              list="manufacturer-suggestions"
              placeholder="Search manufacturer…"
              autoComplete="off"
            />
            <datalist id="manufacturer-suggestions">
              {MANUFACTURERS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </InputGroup>
        )}
      />
      <FormField
        control={control}
        name="model"
        label="Model"
        render={(field) => <Input {...field} placeholder="Victoris" className="h-10" />}
      />
      <FormField
        control={control}
        name="variant"
        label="Variant"
        optional
        render={(field) => <Input {...field} placeholder="LXI" className="h-10" />}
      />
      <FormField
        control={control}
        name="manufacturingYear"
        label="Manufacturing year"
        render={(field) => (
          <Input
            {...field}
            inputMode="numeric"
            maxLength={4}
            placeholder={yearPlaceholder}
            className="h-10 font-mono tabular-nums"
          />
        )}
      />
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="registrationNumber"
          label="Registration number"
          description="As printed on your RC."
          render={(field) => (
            <Input
              {...field}
              onChange={(event) => field.onChange(event.target.value.toUpperCase())}
              placeholder="HR-26-EV-4821"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-10 font-mono uppercase"
            />
          )}
        />
      </div>
      <div className={compact ? undefined : "sm:col-span-2"}>
        <ChoiceField
          name="category"
          label="Vehicle category"
          columns="grid-cols-2 sm:grid-cols-5"
          variant={compact ? "select" : "tiles"}
          options={Object.values(VehicleCategory).map((value) => ({
            value,
            label: CATEGORY_LABELS[value],
            icon: CATEGORY_ICONS[value] ?? CarFront,
          }))}
        />
      </div>
    </div>
  );
}

export function SpecificationsFields({ compact }: SectionProps) {
  const { control } = useFormContext<VehicleFormValues>();
  const isElectric = useWatch({ control, name: "fuelType" }) === FuelType.ELECTRIC;
  const colour = (
    <FormField
      control={control}
      name="colour"
      label="Colour"
      optional
      render={(field) => <Input {...field} placeholder="Pearl Silver" className="h-10" />}
    />
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={compact ? undefined : "sm:col-span-2"}>
        <ChoiceField
          name="fuelType"
          label="Fuel type"
          variant={compact ? "select" : "segmented"}
          columns="grid-cols-5"
          options={Object.values(FuelType).map((value) => ({
            value,
            label: FUEL_TYPE_LABELS[value],
          }))}
        />
      </div>
      <FormField
        control={control}
        name="transmission"
        label="Transmission"
        render={(field) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger
              ref={field.ref}
              id={field.id}
              className="h-10 w-full"
              onBlur={field.onBlur}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Transmission).map((value) => (
                <SelectItem key={value} value={value}>
                  {TRANSMISSION_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {isElectric ? (
        colour
      ) : (
        <>
          <NumberField
            name="engineCapacityCc"
            label="Engine displacement"
            suffix="cc"
            optional
            placeholder="1,462"
          />
          <div className="sm:col-span-2">
            <FormField
              control={control}
              name="engineConfiguration"
              label="Engine configuration"
              optional
              render={(field) => (
                <Input {...field} placeholder="4-cylinder, naturally aspirated" className="h-10" />
              )}
            />
          </div>
          <NumberField
            name="fuelTankCapacityL"
            label="Fuel tank capacity"
            suffix="L"
            placeholder="45"
            optional
          />
          {colour}
        </>
      )}
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Engine and tank fields are hidden for electric vehicles.
      </p>
    </div>
  );
}

/** `savedOdometerKm`: on the edit page, warn (don't block) when the reading goes down. */
export function OwnershipFields({
  compact,
  savedOdometerKm,
}: SectionProps & { savedOdometerKm?: number }) {
  const { control } = useFormContext<VehicleFormValues>();
  const odometer = Number(useWatch({ control, name: "odometerKm" }).replace(/\D/g, ""));
  const lowered = savedOdometerKm !== undefined && odometer > 0 && odometer < savedOdometerKm;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ChoiceField
          name="ownershipType"
          label="Ownership type"
          variant={compact ? "select" : "cards"}
          columns="grid-cols-1 sm:grid-cols-2"
          options={[
            {
              value: OwnershipType.OWNED,
              label: OWNERSHIP_LABELS.OWNED,
              description: "Bought outright",
            },
            {
              value: OwnershipType.FINANCED,
              label: OWNERSHIP_LABELS.FINANCED,
              description: "Bought with a loan. Add EMI details later in Expenses.",
            },
          ]}
        />
      </div>
      <DateField name="purchaseDate" label="Purchase date" pastOnly optional />
      <NumberField
        name="purchasePrice"
        label="Purchase price"
        optional
        prefix="₹"
        placeholder="11,45,000"
        decimals={2}
      />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <NumberField
          name="odometerKm"
          label="Current odometer"
          suffix="km"
          placeholder="8,450"
          description="The reading on your instrument cluster today."
          warning={lowered}
        />
        {lowered && (
          <p role="status" className="flex items-start gap-1.5 text-sm text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Lower than the saved reading of {formatDistance(savedOdometerKm)}. Only lower it to
            correct a mistake.
          </p>
        )}
      </div>
    </div>
  );
}

export function VehicleInfoFields() {
  const { control } = useFormContext<VehicleFormValues>();
  const isElectric = useWatch({ control, name: "fuelType" }) === FuelType.ELECTRIC;
  const text = (
    name: keyof VehicleFormValues,
    label: string,
    placeholder: string,
    mono = false,
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => (
        <Input
          {...field}
          placeholder={placeholder}
          spellCheck={mono ? false : undefined}
          className={mono ? "h-10 font-mono uppercase" : "h-10"}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col divide-y">
      <FieldGroupSection title="Registration & identity">
        <DateField name="registrationDate" label="Registration date" pastOnly optional />
        {text("vin", "VIN / chassis number", "MA3EJKD1S00482910", true)}
        <div className="sm:col-span-2">
          {text("engineNumber", "Engine number", "K15B-9284110", true)}
        </div>
      </FieldGroupSection>
      <FieldGroupSection title="Maintenance specs">
        {text(
          "fuelSpecification",
          "Fuel specification",
          isElectric ? "CCS2 fast charging" : "Petrol, 91 RON, E20 compatible",
        )}
        {!isElectric && text("engineOilSpecification", "Engine oil", "0W-16 synthetic")}
        {text("tyreSize", "Tyre size", "215/60 R17")}
        {text("batteryType", "Battery", "12V 45Ah maintenance-free")}
      </FieldGroupSection>
      <FieldGroupSection title="Warranty">
        <DateField name="warrantyExpiryDate" label="Warranty expires" optional />
        <NumberField
          name="warrantyKmLimit"
          label="Warranty limit"
          suffix="km"
          placeholder="1,00,000"
          optional
        />
      </FieldGroupSection>
      <div className="pt-6">
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(field) => (
            <Textarea {...field} rows={2} placeholder="Optional delivery or accessory notes" />
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inputs

function FieldGroupSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-6 first:pt-0">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  icon?: typeof CarFront;
};

/**
 * One choice from a closed set:
 * - cards: radio + title + description (ownership);
 * - tiles: icon over label (category);
 * - segmented: one joined track (fuel type);
 * - select: a compact dropdown (edit page).
 */
function ChoiceField({
  name,
  label,
  options,
  columns,
  variant = "cards",
}: {
  name: "category" | "fuelType" | "ownershipType";
  label: string;
  options: ChoiceOption[];
  columns: string;
  variant?: "cards" | "tiles" | "segmented" | "select";
}) {
  const { control } = useFormContext<VehicleFormValues>();

  if (variant === "select") {
    return (
      <FormField
        control={control}
        name={name}
        label={label}
        render={(field) => (
          <Select
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              field.onBlur();
            }}
          >
            <SelectTrigger
              ref={field.ref}
              id={field.id}
              aria-invalid={field["aria-invalid"]}
              className="h-10 w-full"
            >
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    );
  }

  const segmented = variant === "segmented";
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field) => (
        <RadioGroup
          value={field.value}
          onValueChange={(value) => {
            field.onChange(value);
            field.onBlur(); // radios have no blur of their own; this revalidates (mode "onTouched")
          }}
          aria-labelledby={`${field.id}-label`}
          aria-invalid={field["aria-invalid"]}
          className={cn(
            "grid",
            columns,
            segmented ? "gap-1 rounded-lg border bg-muted p-1" : "gap-3",
          )}
        >
          {options.map((option) => {
            const id = `${name}-${option.value}`;
            return (
              <FieldLabel
                key={option.value}
                htmlFor={id}
                // Stitch selected card: solid primary border on the raised fill.
                className={cn(
                  "has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary dark:has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-secondary",
                  segmented &&
                    "border-transparent *:data-[slot=field]:justify-center *:data-[slot=field]:px-1 *:data-[slot=field]:py-1.5 has-data-[state=checked]:text-primary",
                )}
              >
                <Field
                  orientation="horizontal"
                  className={variant === "cards" ? undefined : "items-center"}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={id}
                    // `absolute` replaces the item's own `relative`, which otherwise beats sr-only
                    // and leaves an invisible 16px dot (plus gap) in every tile and segment.
                    className={variant === "cards" ? undefined : "absolute sr-only"}
                  />
                  <FieldContent className={segmented ? "items-center" : undefined}>
                    <FieldTitle
                      className={
                        variant === "tiles"
                          ? "flex flex-col items-start gap-1.5"
                          : "flex items-center gap-1.5"
                      }
                    >
                      {option.icon && (
                        <option.icon
                          className={cn(
                            "text-muted-foreground",
                            variant === "tiles"
                              ? "size-5 group-has-data-[state=checked]/field-label:text-primary"
                              : "size-4",
                          )}
                          aria-hidden
                        />
                      )}
                      {option.label}
                    </FieldTitle>
                    {option.description && (
                      <FieldDescription>{option.description}</FieldDescription>
                    )}
                  </FieldContent>
                </Field>
              </FieldLabel>
            );
          })}
        </RadioGroup>
      )}
    />
  );
}

type NumberFieldName =
  "engineCapacityCc" | "fuelTankCapacityL" | "purchasePrice" | "odometerKm" | "warrantyKmLimit";

/** Numbers typed with Indian grouping (1,00,000); the schema strips the commas. */
function NumberField({
  name,
  label,
  prefix,
  suffix,
  placeholder,
  description,
  decimals = 0,
  warning,
  optional,
}: {
  name: NumberFieldName;
  label: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  description?: string;
  decimals?: number;
  /** Amber border: allowed but worth a second look (e.g. a lowered odometer). */
  warning?: boolean;
  optional?: boolean;
}) {
  const { control } = useFormContext<VehicleFormValues>();
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      optional={optional}
      description={description}
      render={({ value, onChange, onBlur, ref, id, name: inputName, disabled, ...aria }) => (
        <InputGroup className={cn("h-10", warning && "border-warning")}>
          {prefix && (
            <InputGroupAddon>
              <InputGroupText>{prefix}</InputGroupText>
            </InputGroupAddon>
          )}
          <NumericFormat
            customInput={InputGroupInput}
            getInputRef={ref}
            id={id}
            name={inputName}
            disabled={disabled}
            aria-invalid={aria["aria-invalid"]}
            value={value}
            onValueChange={(values) => onChange(values.value)}
            onBlur={onBlur}
            inputMode={decimals ? "decimal" : "numeric"}
            thousandSeparator=","
            thousandsGroupStyle="lakh"
            decimalScale={decimals}
            allowNegative={false}
            placeholder={placeholder}
            className="font-mono tabular-nums"
          />
          {suffix && (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{suffix}</InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
      )}
    />
  );
}

/** DatePicker on an ISO (YYYY-MM-DD) form value; shows DD/MM/YYYY. */
function DateField({
  name,
  label,
  pastOnly,
  optional,
}: {
  name: "purchaseDate" | "registrationDate" | "warrantyExpiryDate";
  label: string;
  pastOnly?: boolean;
  optional?: boolean;
}) {
  const { control } = useFormContext<VehicleFormValues>();
  return (
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
          onChange={(date) => {
            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
            field.onBlur();
          }}
          disabledDates={pastOnly ? { after: new Date() } : undefined}
        />
      )}
    />
  );
}
