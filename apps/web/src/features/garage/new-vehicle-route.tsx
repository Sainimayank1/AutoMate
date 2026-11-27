import { createVehicleSchema, type CreateVehicleValues, FuelType } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, CircleCheck } from "lucide-react";
import { useState } from "react";
import { FormProvider, type Resolver, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { FormError } from "@/components/common/form-error";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DetailList } from "@/features/garage/components/detail-list";
import {
  BasicDetailsFields,
  OwnershipFields,
  SpecificationsFields,
  VehicleInfoFields,
} from "@/features/garage/components/vehicle-form";
import {
  emptyVehicleForm,
  sectionOf,
  toVehiclePayload,
  VEHICLE_SECTIONS,
  type VehicleFormValues,
} from "@/features/garage/components/vehicle-form-model";
import {
  CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  OWNERSHIP_LABELS,
  TRANSMISSION_LABELS,
} from "@/features/garage/constants";
import { useCreateVehicle } from "@/features/garage/hooks/use-vehicles";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import {
  formatCurrency,
  formatDate,
  formatDistance,
  formatNumber,
  formatRegistration,
} from "@/utils/format";

const STEPS = [
  ...VEHICLE_SECTIONS.map(({ id, title }) => ({ id, title })),
  { id: "review", title: "Review" },
];
const REVIEW_STEP = STEPS.length - 1;
const STEP_FIELDS = [
  <BasicDetailsFields key="basic" />,
  <SpecificationsFields key="specifications" />,
  <OwnershipFields key="ownership" />,
  <VehicleInfoFields key="info" />,
];

/**
 * Stitch "Add Vehicle Wizard" (desktop and mobile): five steps, nothing saved until the last one.
 * Going back never loses input; leaving with input asks first.
 */
export function Component() {
  const navigate = useNavigate();
  const create = useCreateVehicle();
  const [step, setStep] = useState(0);
  const form = useForm<VehicleFormValues, unknown, CreateVehicleValues>({
    resolver: zodResolver(createVehicleSchema) as unknown as Resolver<
      VehicleFormValues,
      unknown,
      CreateVehicleValues
    >,
    defaultValues: emptyVehicleForm,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting, errors } = form.formState;
  const isReview = step === REVIEW_STEP;

  const goTo = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  async function next() {
    const section = VEHICLE_SECTIONS[step];
    if (section && !(await form.trigger(section.fields, { shouldFocus: true }))) return;
    goTo(step + 1);
  }

  const submit = form.handleSubmit(
    async (values) => {
      try {
        const vehicle = await create.mutateAsync(toVehiclePayload(values));
        navigate(`/garage/${vehicle.id}`, { replace: true, state: { savedChanges: true } });
      } catch (error) {
        applyServerErrors(form.setError, error);
        // formState isn't updated yet inside this handler; read the fields from the API error.
        const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
        if (field) goTo(sectionOf(field));
      }
    },
    // Only reachable if a step was skipped; jump to the first invalid field's step.
    (fieldErrors) => goTo(sectionOf(Object.keys(fieldErrors)[0] ?? "")),
  );

  return (
    <TaskPage
      title="Add vehicle to garage"
      mobileTitle="Add vehicle"
      closeOnMobile
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]!.title}`}
      backTo="/garage"
      backLabel="Back to garage"
      actions={
        <Button variant="ghost" asChild className="max-md:hidden">
          <Link to="/garage">Cancel</Link>
        </Button>
      }
      banner={<StepRail step={step} />}
    >
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (isReview) void submit();
            else void next();
          }}
          // Phones: room for the fixed action bar.
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 pb-28 sm:p-8"
        >
          <FormError message={errors.root?.server?.message} />

          {isReview ? (
            <ReviewStep values={form.getValues()} onEdit={goTo} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">
                  {step === 0 ? "Basic vehicle details" : VEHICLE_SECTIONS[step]!.title}
                </CardTitle>
                {VEHICLE_SECTIONS[step]!.description && (
                  <p className="text-sm text-muted-foreground">
                    {VEHICLE_SECTIONS[step]!.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>{STEP_FIELDS[step]}</CardContent>
            </Card>
          )}

          {/* Phones: a fixed bottom bar with a full-width primary action (Stitch mobile). */}
          <footer className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:bg-transparent sm:p-0 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={step === 0 || isSubmitting}
              onClick={() => goTo(step - 1)}
              className={cn(step === 0 && "max-sm:hidden")}
            >
              <ArrowLeft data-icon="inline-start" />
              <span className="max-sm:sr-only">Previous</span>
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting} className="max-sm:flex-1">
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isReview ? "Add vehicle to garage" : `Next: ${STEPS[step + 1]!.title}`}
              {!isReview && <ArrowRight data-icon="inline-end" />}
            </Button>
          </footer>
        </form>
      </FormProvider>

      <UnsavedChangesGuard
        when={isDirty}
        title="Discard this vehicle?"
        description="Nothing has been saved yet. You'll lose what you've entered."
      />
    </TaskPage>
  );
}

/**
 * Progress (Stitch): five labelled segments, completed ones green with a check; on phones one
 * continuous bar (the header subtitle names the step).
 */
function StepRail({ step }: { step: number }) {
  return (
    <div className="border-b">
      <div className="px-4 py-3 sm:hidden" aria-hidden>
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
      <nav aria-label="Progress" className="max-sm:hidden">
        <ol className="mx-auto grid max-w-3xl grid-cols-5 gap-3 px-8 py-4">
          {STEPS.map((item, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-1.5"
                aria-current={current ? "step" : undefined}
              >
                <div
                  className={cn(
                    "h-1 rounded-full",
                    done ? "bg-success" : current ? "bg-primary" : "bg-border",
                  )}
                />
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    done ? "text-success" : current ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {done && <CircleCheck className="size-3.5" aria-hidden />}
                  {index + 1}. {item.title}
                  {done && <span className="sr-only">(completed)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

/** Step 5: read-only summary per step, each with "Edit" to jump back. */
function ReviewStep({
  values,
  onEdit,
}: {
  values: VehicleFormValues;
  onEdit: (step: number) => void;
}) {
  const number = (value: string, unit: string) => (value ? `${formatNumber(value)} ${unit}` : null);
  const date = (value: string) => (value ? formatDate(value) : null);
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
  const isElectric = values.fuelType === FuelType.ELECTRIC;
  const groups = [
    [
      { label: "Manufacturer", value: values.make.trim() },
      { label: "Model & variant", value: [values.model, values.variant].filter(Boolean).join(" ") },
      { label: "Manufacturing year", value: values.manufacturingYear },
      { label: "Vehicle category", value: values.category && CATEGORY_LABELS[values.category] },
      {
        label: "Registration number",
        value: formatRegistration(values.registrationNumber),
        mono: true,
      },
    ],
    [
      { label: "Fuel type", value: FUEL_TYPE_LABELS[values.fuelType] },
      { label: "Transmission", value: TRANSMISSION_LABELS[values.transmission] },
      // Engine and tank values typed before switching to Electric aren't saved.
      ...(isElectric
        ? []
        : [
            {
              label: "Engine",
              value: join(number(values.engineCapacityCc, "cc"), values.engineConfiguration),
            },
            { label: "Fuel tank", value: number(values.fuelTankCapacityL, "L") },
          ]),
      { label: "Colour", value: values.colour },
    ],
    [
      { label: "Ownership", value: OWNERSHIP_LABELS[values.ownershipType] },
      { label: "Purchase date", value: date(values.purchaseDate) },
      {
        label: "Purchase price",
        value: values.purchasePrice && formatCurrency(values.purchasePrice),
      },
      {
        label: "Current odometer",
        value: values.odometerKm && formatDistance(values.odometerKm),
        mono: true,
      },
    ],
    [
      { label: "Registration date", value: date(values.registrationDate) },
      { label: "VIN / chassis number", value: values.vin.toUpperCase(), mono: true },
      { label: "Engine number", value: values.engineNumber.toUpperCase(), mono: true },
      { label: "Fuel specification", value: values.fuelSpecification },
      ...(isElectric ? [] : [{ label: "Engine oil", value: values.engineOilSpecification }]),
      { label: "Tyre size", value: values.tyreSize, mono: true },
      { label: "Battery", value: values.batteryType },
      {
        label: "Warranty",
        value: join(date(values.warrantyExpiryDate), number(values.warrantyKmLimit, "km")),
      },
      { label: "Notes", value: values.notes },
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      {VEHICLE_SECTIONS.map((section, index) => (
        <Card key={section.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="font-heading text-base">{section.title}</CardTitle>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => onEdit(index)}
            >
              Edit<span className="sr-only"> {section.title.toLowerCase()}</span>
            </Button>
          </CardHeader>
          <CardContent>
            <DetailList items={groups[index]!} />
          </CardContent>
        </Card>
      ))}
      <p className="text-sm text-muted-foreground">This vehicle becomes your active vehicle.</p>
    </div>
  );
}
