import { createVehicleSchema, type CreateVehicleValues, type Vehicle } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { CarFront } from "lucide-react";
import { useEffect } from "react";
import { FormProvider, type Resolver, useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { FormError } from "@/components/common/form-error";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TaskPage } from "@/components/layout/task-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  BasicDetailsFields,
  OwnershipFields,
  SpecificationsFields,
  VehicleInfoFields,
} from "@/features/garage/components/vehicle-form";
import {
  sectionOf,
  toFormValues,
  toVehiclePayload,
  VEHICLE_SECTIONS,
  type VehicleFormValues,
} from "@/features/garage/components/vehicle-form-model";
import { vehicleName } from "@/features/garage/constants";
import { useUpdateVehicle, useVehicle } from "@/features/garage/hooks/use-vehicles";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatRegistration } from "@/utils/format";

/** Stitch "Edit Vehicle": one sectioned form page (no stepper) with a section index on desktop. */
export function Component() {
  const { vehicleId = "" } = useParams();
  const { data: vehicle, isPending, isError, error, refetch } = useVehicle(vehicleId);

  if (isPending) return <LoadingState fullScreen label="Loading vehicle…" />;
  if (isError || !vehicle) {
    return error?.status === 404 || error?.status === 400 ? (
      <EmptyState
        className="min-h-svh"
        icon={CarFront}
        title="Vehicle not found"
        description="It may have been deleted, or it isn't in your garage."
        action={
          <Button asChild>
            <Link to="/garage">Back to garage</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load this vehicle"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }
  // Keyed: a different vehicle starts a fresh form.
  return <EditVehicleForm key={vehicle.id} vehicle={vehicle} />;
}

// Stitch "Edit Vehicle" uses compact selects where the wizard has cards.
const SECTION_FIELDS = [
  <BasicDetailsFields key="basic" compact />,
  <SpecificationsFields key="specifications" compact />,
  null, // ownership: needs the saved odometer, rendered below
  <VehicleInfoFields key="info" />,
];

function EditVehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const update = useUpdateVehicle(vehicle.id);
  const detailsHref = `/garage/${vehicle.id}`;
  const form = useForm<VehicleFormValues, unknown, CreateVehicleValues>({
    resolver: zodResolver(createVehicleSchema) as unknown as Resolver<
      VehicleFormValues,
      unknown,
      CreateVehicleValues
    >,
    defaultValues: toFormValues(vehicle),
    mode: "onTouched",
  });
  const { isDirty, isSubmitting, errors } = form.formState;

  // "Add" links on the details page point at a section (#info, #ownership…).
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync(toVehiclePayload(values));
        navigate(detailsHref, { replace: true, state: { savedChanges: true } });
      } catch (error) {
        applyServerErrors(form.setError, error);
        // formState isn't updated yet inside this handler; read the fields from the API error.
        const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
        if (field)
          document.getElementById(VEHICLE_SECTIONS[sectionOf(field)]!.id)?.scrollIntoView();
      }
    },
    (fieldErrors) =>
      document
        .getElementById(VEHICLE_SECTIONS[sectionOf(Object.keys(fieldErrors)[0] ?? "")]!.id)
        ?.scrollIntoView(),
  );

  return (
    <TaskPage
      title="Edit vehicle"
      subtitle={`${vehicleName(vehicle)} · ${formatRegistration(vehicle.registrationNumber)}`}
      backTo={detailsHref}
      backLabel="Back to vehicle"
      actions={
        <>
          {isDirty && (
            <Badge className="hidden bg-warning text-background sm:inline-flex">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link to={detailsHref}>Cancel</Link>
          </Button>
          <Button type="submit" form="edit-vehicle" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Save changes
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <div className="mx-auto grid w-full max-w-5xl gap-8 p-4 sm:p-8 lg:grid-cols-[12rem_1fr]">
          <nav aria-label="Sections" className="hidden lg:block">
            <ol className="sticky top-24 flex flex-col gap-1 text-sm">
              {VEHICLE_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <form
            id="edit-vehicle"
            noValidate
            onSubmit={submit}
            className="flex min-w-0 flex-col gap-6"
          >
            <FormError message={errors.root?.server?.message} />
            {VEHICLE_SECTIONS.map((section, index) => (
              <Card key={section.id} id={section.id} className="scroll-mt-24">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {SECTION_FIELDS[index] ?? (
                    <OwnershipFields compact savedOdometerKm={vehicle.odometerKm} />
                  )}
                </CardContent>
              </Card>
            ))}
            <div className="flex justify-end gap-2 sm:hidden">
              <Button variant="outline" asChild>
                <Link to={detailsHref}>Cancel</Link>
              </Button>
            </div>
          </form>
        </div>
      </FormProvider>

      <UnsavedChangesGuard when={isDirty} />
    </TaskPage>
  );
}
