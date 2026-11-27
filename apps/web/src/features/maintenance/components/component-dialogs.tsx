import {
  ComponentCondition,
  inspectComponentSchema,
  type InspectComponentValues,
  istToday,
  removeComponentSchema,
  type RemoveComponentValues,
  type VehicleComponent,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import type { ReactNode } from "react";
import { FormProvider, type Resolver, useForm, useFormContext, useWatch } from "react-hook-form";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS } from "@/features/maintenance/constants";
import {
  useInspectComponent,
  useRetireComponent,
} from "@/features/maintenance/hooks/use-maintenance";
import { applyServerErrors } from "@/lib/forms";

type DialogProps = { part: VehicleComponent; open: boolean; onOpenChange: (open: boolean) => void };

/** Date + odometer + notes, shared by both dialogs (read from the form's context). */
function CommonFields({ children }: { children?: ReactNode }) {
  const { control } = useFormContext<{ date: string; odometerKm: string; notes: string }>();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
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
              disabledDates={{ after: new Date() }}
            />
          )}
        />
        <FormField
          control={control}
          name="odometerKm"
          label="Odometer"
          optional
          render={(field) => <NumberInput {...field} suffix="km" placeholder="0" />}
        />
      </div>
      {children}
      <FormField
        control={control}
        name="notes"
        label="Notes"
        optional
        render={(field) => <Textarea {...field} rows={2} maxLength={500} />}
      />
    </>
  );
}

function ConditionField() {
  const { control } = useFormContext<InspectValues>();
  return (
    <FormField
      control={control}
      name="condition"
      label="Condition"
      render={(field) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger ref={field.ref} id={field.id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ComponentCondition).map((condition) => (
              <SelectItem key={condition} value={condition}>
                {CONDITION_LABELS[condition]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

type InspectValues = {
  date: string;
  odometerKm: string;
  condition: ComponentCondition;
  notes: string;
};

/** Stitch "Record Inspection Dialog": the user's own check, setting the part's condition. */
export function InspectDialog({ part, open, onOpenChange }: DialogProps) {
  const inspect = useInspectComponent(part.vehicleId, part.id);
  const form = useForm<InspectValues, unknown, InspectComponentValues>({
    resolver: zodResolver(inspectComponentSchema) as unknown as Resolver<
      InspectValues,
      unknown,
      InspectComponentValues
    >,
    defaultValues: {
      date: istToday(new Date()),
      odometerKm: "",
      condition: part.condition,
      notes: "",
    },
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await inspect.mutateAsync(values);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Record inspection</DialogTitle>
              <DialogDescription>Your own check, not a professional inspection.</DialogDescription>
            </DialogHeader>
            <FormError message={form.formState.errors.root?.server?.message} />
            <CommonFields>
              <ConditionField />
            </CommonFields>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
                Save inspection
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

type RemoveValues = { date: string; odometerKm: string; failed: boolean; notes: string };

/** Stitch "Remove Component Dialog": taken off without a replacement; its history is kept. */
export function RemoveDialog({ part, open, onOpenChange }: DialogProps) {
  const retire = useRetireComponent(part.vehicleId, part.id);
  const form = useForm<RemoveValues, unknown, RemoveComponentValues>({
    resolver: zodResolver(removeComponentSchema) as unknown as Resolver<
      RemoveValues,
      unknown,
      RemoveComponentValues
    >,
    defaultValues: { date: istToday(new Date()), odometerKm: "", failed: false, notes: "" },
  });
  const failed = useWatch({ control: form.control, name: "failed" });
  const submit = form.handleSubmit(async (values) => {
    try {
      await retire.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Mark {part.name.toLowerCase()} removed</DialogTitle>
              <DialogDescription>
                It moves to "Replaced &amp; removed". Its history is kept, and schedules stop
                watching it.
              </DialogDescription>
            </DialogHeader>
            <FormError message={form.formState.errors.root?.server?.message} />
            <CommonFields>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="component-failed"
                  checked={failed}
                  onCheckedChange={(checked) => form.setValue("failed", checked === true)}
                />
                <Label htmlFor="component-failed">It failed</Label>
              </div>
            </CommonFields>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
                Mark removed
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
