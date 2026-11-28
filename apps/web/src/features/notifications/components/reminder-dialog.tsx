import {
  createReminderSchema,
  type CreateReminderValues,
  type Reminder,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { type Control, type Resolver, useForm } from "react-hook-form";
import { z } from "zod";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
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
import { vehicleName } from "@/features/garage/constants";
import { LEAD_OPTIONS } from "@/features/notifications/constants";
import { useSaveReminder } from "@/features/notifications/hooks/use-notifications";
import { applyServerErrors } from "@/lib/forms";

/** Radix Select can't hold an empty value: this one stands for "no vehicle". */
const NO_VEHICLE = "none";

type ReminderForm = {
  title: string;
  dueDate: string;
  remindDaysBefore: string;
  vehicleId: string;
  notes: string;
};

const formSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && "vehicleId" in value && value.vehicleId === NO_VEHICLE
      ? { ...value, vehicleId: null }
      : value,
  createReminderSchema,
  // The resolver needs the form's own input type; the shared schema checks the values.
) as unknown as z.ZodType<CreateReminderValues, ReminderForm>;

/**
 * Stitch "Add Reminder Dialog": what, when, how many days before, an optional vehicle and notes.
 * Editing uses the same dialog. Deviation: "Remind me" also keeps a lead the user set elsewhere
 * (shown as "N days before") rather than snapping it to a listed choice.
 */
export function ReminderDialog({
  open,
  onOpenChange,
  vehicles,
  vehicleId,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  /** Preselected (the dashboard's "Add reminder" passes its vehicle). */
  vehicleId?: string | null;
  editing?: Reminder;
}) {
  const save = useSaveReminder();
  const lead = editing?.remindDaysBefore ?? 1;
  const form = useForm<ReminderForm, unknown, CreateReminderValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<
      ReminderForm,
      unknown,
      CreateReminderValues
    >,
    defaultValues: {
      title: editing?.title ?? "",
      dueDate: editing?.dueDate ?? "",
      remindDaysBefore: String(lead),
      vehicleId: editing?.vehicleId ?? vehicleId ?? NO_VEHICLE,
      notes: editing?.notes ?? "",
    },
  });
  const control = form.control as unknown as Control<ReminderForm>;
  const { isSubmitting, errors } = form.formState;
  const [closing, setClosing] = useState(false);
  const leads = LEAD_OPTIONS.some((option) => option.days === lead)
    ? LEAD_OPTIONS
    : [...LEAD_OPTIONS, { days: lead, label: `${lead} days before` }];

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: editing?.id, values });
      setClosing(true);
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={open && !closing} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit reminder" : "Add reminder"}</DialogTitle>
          <DialogDescription>
            It shows in your notifications, and on the vehicle&apos;s dashboard when it has one.
          </DialogDescription>
        </DialogHeader>
        <form id="reminder-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={control}
            name="title"
            label="What to remind you about"
            render={(field) => (
              <Input {...field} placeholder="e.g. Get the tyres rotated" className="h-10" />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="dueDate"
              label="Date"
              render={(field) => (
                <DatePicker
                  id={field.id}
                  ref={field.ref}
                  aria-invalid={field["aria-invalid"]}
                  value={field.value ? parseISO(field.value) : undefined}
                  onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                />
              )}
            />
            <FormField
              control={control}
              name="remindDaysBefore"
              label="Remind me"
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
                    {leads.map((option) => (
                      <SelectItem key={option.days} value={String(option.days)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <FormField
            control={control}
            name="vehicleId"
            label="Vehicle"
            optional
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
                  <SelectItem value={NO_VEHICLE}>No vehicle</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicleName(vehicle)} · {vehicle.registrationNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => <Textarea {...field} rows={3} />}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="reminder-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
