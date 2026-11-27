import {
  type CreateProviderValues,
  providerFieldsSchema,
  type ProviderProfile,
  ProviderType,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { FormProvider, type Resolver, useForm, useFormContext } from "react-hook-form";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  workshopForm,
  type WorkshopFormValues,
} from "@/features/maintenance/components/workshop-form-model";
import { PROVIDER_TYPE_LABELS } from "@/features/maintenance/constants";
import { useCreateWorkshop, useUpdateWorkshop } from "@/features/maintenance/hooks/use-maintenance";
import { applyServerErrors } from "@/lib/forms";

const schema = providerFieldsSchema.omit({ id: true });
type Output = Omit<CreateProviderValues, "id">;

/**
 * Stitch "Add Workshop Dialog" (and its edit variant): a workshop's profile. Phones get the same
 * dialog (deviation from the Stitch bottom sheet, as the module's other dialogs).
 */
export function WorkshopDialog({
  workshop,
  open,
  onOpenChange,
  onSaved,
}: {
  /** Editing this workshop; omitted to add one. */
  workshop?: ProviderProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (workshop: ProviderProfile) => void;
}) {
  const create = useCreateWorkshop();
  const update = useUpdateWorkshop(workshop?.id ?? "");
  // One id per new workshop: a retried save returns the workshop it already made.
  const [id, setId] = useState(() => crypto.randomUUID());
  const form = useForm<WorkshopFormValues, unknown, Output>({
    resolver: zodResolver(schema) as unknown as Resolver<WorkshopFormValues, unknown, Output>,
    defaultValues: workshopForm(workshop),
  });
  useEffect(() => {
    if (open) form.reset(workshopForm(workshop));
  }, [open, workshop, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = workshop
        ? await update.mutateAsync(values)
        : await create.mutateAsync({ ...values, id });
      if (!workshop) setId(crypto.randomUUID());
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <FormProvider {...form}>
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{workshop ? "Edit workshop" : "Add workshop"}</DialogTitle>
              <DialogDescription>Shared by all your vehicles</DialogDescription>
            </DialogHeader>
            <FormError message={form.formState.errors.root?.server?.message} />
            <WorkshopFields />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
                Save workshop
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

function WorkshopFields() {
  const { control } = useFormContext<WorkshopFormValues>();
  const text = (
    name: "city" | "phone" | "email",
    label: string,
    props: { placeholder?: string; maxLength: number; type?: string; inputMode?: "tel" },
  ) => (
    <FormField
      control={control}
      name={name}
      label={label}
      optional
      render={(field) => <Input {...field} {...props} />}
    />
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="name"
          label="Name"
          render={(field) => (
            <Input {...field} placeholder="e.g. Maruti Arena Service, Gurugram" maxLength={120} />
          )}
        />
      </div>
      <FormField
        control={control}
        name="type"
        label="Type"
        render={(field) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger ref={field.ref} id={field.id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ProviderType).map((type) => (
                <SelectItem key={type} value={type}>
                  {PROVIDER_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {text("city", "City", { placeholder: "e.g. Gurugram", maxLength: 60 })}
      {text("phone", "Phone", {
        placeholder: "+91 98100 12345",
        maxLength: 20,
        type: "tel",
        inputMode: "tel",
      })}
      {text("email", "Email", { maxLength: 120, type: "email" })}
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="address"
          label="Address"
          optional
          render={(field) => <Textarea {...field} rows={2} maxLength={200} />}
        />
      </div>
      <FormField
        control={control}
        name="preferred"
        label="Preferred workshop"
        description="Shown first in lists and suggestions"
        render={(field) => (
          <Switch
            ref={field.ref}
            id={field.id}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <div className="sm:col-span-2">
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(field) => <Textarea {...field} rows={2} maxLength={1000} />}
        />
      </div>
    </div>
  );
}
