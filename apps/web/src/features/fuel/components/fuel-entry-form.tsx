import type { Vehicle } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, type Resolver, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { FormError } from "@/components/common/form-error";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useFuelEntries } from "@/features/fuel/hooks/use-fuel";
import { vehicleName } from "@/features/garage/constants";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatDistance } from "@/utils/format";

import { FuelEntryFields } from "./fuel-entry-fields";
import { type FuelFormOutput, fuelFormSchema, type FuelFormValues } from "./fuel-form-model";

type FuelEntryFormProps = {
  mode: "create" | "edit";
  /** Adding: every vehicle in use. Editing: just the entry's vehicle. */
  vehicles: Vehicle[];
  defaultValues: FuelFormValues;
  editingId?: string;
  /** `changed`: only the fields the user changed (what an edit sends, as a PATCH). */
  onSave: (values: FuelFormOutput, changed: Partial<FuelFormOutput>) => Promise<unknown>;
};

const BACK_TO = "/fuel";

/** Stitch "Add Fuel" and "Edit Fill-up": a focused task page with one form card. */
export function FuelEntryForm({
  mode,
  vehicles,
  defaultValues,
  editingId,
  onSave,
}: FuelEntryFormProps) {
  const navigate = useNavigate();
  const form = useForm<FuelFormValues, unknown, FuelFormOutput>({
    resolver: zodResolver(fuelFormSchema) as unknown as Resolver<
      FuelFormValues,
      unknown,
      FuelFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting, errors } = form.formState;
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const vehicle = vehicles.find((item) => item.id === vehicleId) ?? vehicles[0]!;
  // The latest page: enough for the last reading and recent stations.
  const history = useFuelEntries(vehicle.id).data?.items ?? [];
  const creating = mode === "create";

  const submit = form.handleSubmit(async (values) => {
    try {
      // Untouched fields stay exactly as stored (e.g. a time saved with seconds by another client).
      const { dirtyFields } = form.formState;
      const changed = Object.fromEntries(
        Object.entries(values).filter(([key]) => dirtyFields[key as keyof FuelFormValues]),
      ) as Partial<FuelFormOutput>;
      await onSave(values, changed);
      navigate(BACK_TO, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
      // formState isn't updated yet inside this handler; read the fields from the API error.
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof FuelFormValues);
    }
  });

  const save = (
    <Button type="submit" form="fuel-entry" disabled={isSubmitting || (!creating && !isDirty)}>
      {isSubmitting && <Spinner data-icon="inline-start" />}
      {creating ? "Save fuel log" : "Save changes"}
    </Button>
  );

  return (
    <TaskPage
      title={creating ? "Record fuel fill-up" : "Edit fill-up"}
      mobileTitle={creating ? "Add fuel" : undefined}
      closeOnMobile
      subtitle={`${vehicleName(vehicle)} · Last odometer: ${formatDistance(vehicle.odometerKm)}`}
      backTo={BACK_TO}
      backLabel="Back to fuel"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={BACK_TO}>Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="fuel-entry"
          noValidate
          onSubmit={submit}
          className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8"
        >
          <Card>
            <CardContent className="flex flex-col gap-5">
              <FormError message={errors.root?.server?.message} />
              <FuelEntryFields
                vehicle={vehicle}
                vehicles={creating ? vehicles : undefined}
                history={history}
                editingId={editingId}
              />
              <div className="flex items-center justify-end gap-3 border-t pt-4">
                <Button variant="outline" asChild>
                  <Link to={BACK_TO}>Cancel</Link>
                </Button>
                {save}
              </div>
            </CardContent>
          </Card>
        </form>
      </FormProvider>

      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}
