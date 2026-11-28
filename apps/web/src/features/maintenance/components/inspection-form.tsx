import {
  FLAGGED_CONDITIONS,
  type Inspection,
  INSPECTION_AREAS,
  INSPECTION_TEMPLATES,
  type InspectionArea,
  InspectionCondition,
  inspectionCounts,
  type InspectionTemplateKey,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { Info, Plus, X } from "lucide-react";
import {
  Controller,
  FormProvider,
  type Resolver,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { TaskPage } from "@/components/layout/task-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
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
import { FormSection } from "@/features/maintenance/components/form-section";
import {
  type InspectionFormOutput,
  inspectionFormSchema,
  type InspectionFormValues,
  newItem,
  templateItems,
  templateName,
} from "@/features/maintenance/components/inspection-form-model";
import {
  INSPECTION_CONDITION_META,
  INSPECTION_KIND_LABELS,
  TONE_ACCENT,
  TONE_SOFT,
  TONE_TEXT,
} from "@/features/maintenance/constants";
import { useProviders } from "@/features/maintenance/hooks/use-maintenance";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatDistance, formatNumber } from "@/utils/format";

const NONE = "none";
/** A part a finding can name (id and name are all the form needs). */
type PartOption = { id: string; name: string };
const KINDS = [
  { value: "SELF_CHECK" as const, label: INSPECTION_KIND_LABELS.SELF_CHECK },
  { value: "PROFESSIONAL" as const, label: INSPECTION_KIND_LABELS.PROFESSIONAL },
];

/**
 * Stitch "Inspection Checklist" (and its edit variant): who checked and when, the checklist by
 * area (a template fills it; items can be added and removed), and a follow-up. Flagged items ask
 * for a recommended action and can name a tracked part. Saving opens the inspection.
 * Deviations: the template is chosen only when starting (editing keeps the checklist), and a
 * professional inspection asks for the workshop and the inspector separately.
 */
export function InspectionForm({
  mode,
  vehicle,
  components,
  defaultValues,
  backTo,
  onSave,
}: {
  mode: "create" | "edit";
  vehicle: Vehicle;
  components: PartOption[];
  defaultValues: InspectionFormValues;
  backTo: string;
  onSave: (values: InspectionFormOutput) => Promise<Inspection>;
}) {
  const navigate = useNavigate();
  const form = useForm<InspectionFormValues, unknown, InspectionFormOutput>({
    resolver: zodResolver(inspectionFormSchema) as unknown as Resolver<
      InspectionFormValues,
      unknown,
      InspectionFormOutput
    >,
    defaultValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting } = form.formState;
  const creating = mode === "create";

  const submit = form.handleSubmit(async (output) => {
    try {
      const saved = await onSave(output);
      navigate(`/maintenance/inspections/${saved.id}`, {
        replace: true,
        state: { savedChanges: true },
      });
    } catch (error) {
      applyServerErrors(form.setError, error);
      const field = Object.keys(normalizeApiError(error).fieldErrors)[0];
      if (field) form.setFocus(field as keyof InspectionFormValues);
    }
  });

  return (
    <TaskPage
      title={creating ? "New inspection" : "Edit inspection"}
      subtitle={`${vehicleName(vehicle)} · ${formatDistance(vehicle.odometerKm)}`}
      backTo={backTo}
      backLabel="Back"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <FormProvider {...form}>
        <form
          id="inspection-form"
          noValidate
          onSubmit={submit}
          className="mx-auto grid w-full max-w-6xl items-start gap-6 p-4 pb-28 sm:p-6 sm:pb-28 lg:grid-cols-12"
        >
          <InspectionFields creating={creating} vehicle={vehicle} components={components} />
        </form>
      </FormProvider>
      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-end gap-3 border-t bg-card px-4 sm:px-6">
        <Button variant="outline" asChild>
          <Link to={backTo}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          form="inspection-form"
          disabled={isSubmitting || (!creating && !isDirty)}
        >
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {creating ? "Save inspection" : "Save changes"}
        </Button>
      </footer>
      <UnsavedChangesGuard when={isDirty && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}

function InspectionFields({
  creating,
  vehicle,
  components,
}: {
  creating: boolean;
  vehicle: Vehicle;
  components: PartOption[];
}) {
  const form = useFormContext<InspectionFormValues>();
  const { control } = form;
  const { errors } = form.formState;
  const values = useWatch({ control });
  // keyName: items carry their own `id` (kept on edit).
  const items = useFieldArray({ control, name: "items", keyName: "key" });
  const providers = useProviders().data ?? [];

  const conditions = (values.items ?? []).flatMap((item) =>
    item.condition ? [item.condition] : [],
  );
  const counts = inspectionCounts(conditions);
  const checked = conditions.length - counts.notInspected;
  const flagged = (values.items ?? []).filter(
    (item) => item.condition && FLAGGED_CONDITIONS.includes(item.condition),
  );
  const shownAreas = INSPECTION_AREAS.filter(([area]) =>
    items.fields.some((item) => item.area === area),
  );
  const otherAreas = INSPECTION_AREAS.filter(([area]) => !shownAreas.some(([a]) => a === area));
  const add = (area: InspectionArea) =>
    items.append(newItem(area), { focusName: `items.${items.fields.length}.label` });
  const professional = values.kind === "PROFESSIONAL";

  return (
    <>
      <div className="flex flex-col gap-5 lg:col-span-8">
        <FormError message={errors.root?.server?.message} />
        <FormSection step={1} title="Inspection">
          <div className="grid gap-4 sm:grid-cols-2">
            {creating && (
              <FormField
                control={control}
                name="templateKey"
                label="Template"
                render={(field) => (
                  <Select
                    value={field.value}
                    onValueChange={(key: InspectionTemplateKey) => {
                      // A title still matching the old template follows the new one.
                      const title = form.getValues("title");
                      if (!title || title === templateName(field.value)) {
                        form.setValue("title", templateName(key), { shouldDirty: true });
                      }
                      items.replace(templateItems(key));
                      field.onChange(key);
                    }}
                  >
                    <SelectTrigger ref={field.ref} id={field.id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSPECTION_TEMPLATES.map((template) => (
                        <SelectItem key={template.key} value={template.key}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            <FormField
              control={control}
              name="kind"
              label="Kind"
              render={(field) => (
                <Segmented
                  value={field.value}
                  options={KINDS}
                  onChange={field.onChange}
                  aria-labelledby={`${field.id}-label`}
                  className="w-full *:flex-1"
                />
              )}
            />
            <div className="sm:col-span-2">
              <FormField
                control={control}
                name="title"
                label="Title"
                render={(field) => (
                  <Input {...field} placeholder="e.g. Monthly check" maxLength={80} />
                )}
              />
            </div>
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
              name="odometerKm"
              label="Odometer"
              optional
              render={(field) => (
                <NumberInput
                  {...field}
                  suffix="km"
                  placeholder={formatNumber(vehicle.odometerKm)}
                />
              )}
            />
            {professional && (
              <FormField
                control={control}
                name="providerName"
                label="Workshop"
                optional
                render={(field) => (
                  <>
                    <Input
                      {...field}
                      list="inspection-workshops"
                      autoComplete="off"
                      placeholder="e.g. Maruti Arena Service, Gurugram"
                      maxLength={120}
                    />
                    <datalist id="inspection-workshops">
                      {providers.map((provider) => (
                        <option key={provider.id} value={provider.name} />
                      ))}
                    </datalist>
                  </>
                )}
              />
            )}
            <div className={cn(!professional && "sm:col-span-2")}>
              <FormField
                control={control}
                name="inspector"
                label={professional ? "Inspector" : "Checked by"}
                optional
                render={(field) => <Input {...field} maxLength={80} />}
              />
            </div>
          </div>
          {!professional && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" aria-hidden />
              Your own check is not a professional inspection.
            </p>
          )}
        </FormSection>

        <FormSection
          step={2}
          title="Checklist"
          aside={
            <span className="text-sm font-medium text-primary tabular-nums">
              {checked} of {conditions.length} checked
            </span>
          }
        >
          <FormError message={errors.items?.message ?? errors.items?.root?.message} />
          {shownAreas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No items yet. Add what you checked, area by area.
            </p>
          )}
          {shownAreas.map(([area, name], index) => (
            <div key={area} className={cn("flex flex-col gap-3", index > 0 && "border-t pt-4")}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">{name}</h3>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => add(area)}
                >
                  <Plus data-icon="inline-start" />
                  Add item<span className="sr-only"> to {name}</span>
                </Button>
              </div>
              {items.fields.map(
                (item, itemIndex) =>
                  item.area === area && (
                    <ItemCard
                      key={item.key}
                      index={itemIndex}
                      components={components}
                      onRemove={() => items.remove(itemIndex)}
                    />
                  ),
              )}
            </div>
          ))}
          {otherAreas.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-fit">
                  <Plus data-icon="inline-start" />
                  Add another area
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {otherAreas.map(([area, name]) => (
                  <DropdownMenuItem key={area} onSelect={() => add(area)}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </FormSection>

        <FormSection step={3} title="Follow-up">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="followUpDate"
              label="Follow-up date"
              optional
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
                />
              )}
            />
          </div>
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => (
              <Textarea
                {...field}
                rows={2}
                maxLength={1000}
                placeholder="Overall observations or reminders"
              />
            )}
          />
        </FormSection>
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-medium">Summary</h2>
          <Badge variant="secondary">{INSPECTION_KIND_LABELS[values.kind ?? "SELF_CHECK"]}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Count label="Issues" value={counts.issues} className="text-warning" />
          <Count label="Monitor" value={counts.monitor} className="text-info" />
          <Count label="Good" value={counts.ok} className="text-success" />
          <Count
            label="Not inspected"
            value={counts.notInspected}
            className="text-muted-foreground"
          />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">Flagged items</span>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing flagged.</p>
          ) : (
            flagged.map((item, index) => {
              const meta = INSPECTION_CONDITION_META[item.condition!];
              return (
                <div
                  key={index}
                  className={cn(
                    "rounded-md border-l-2 bg-muted/40 px-3 py-2",
                    TONE_ACCENT[meta.tone],
                  )}
                >
                  <p className="text-sm font-medium">
                    {item.label || "Unnamed item"} · {meta.label}
                  </p>
                  {item.recommendedAction && (
                    <p className="text-sm text-muted-foreground">{item.recommendedAction}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <span className={cn("block text-xs font-medium", className)}>{label}</span>
      <span className="font-heading text-lg font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** One checklist item; a flagged one (or one naming a part) asks for its action and part. */
function ItemCard({
  index,
  components,
  onRemove,
}: {
  index: number;
  components: PartOption[];
  onRemove: () => void;
}) {
  const { control } = useFormContext<InspectionFormValues>();
  const [label, condition, componentId] = useWatch({
    control,
    name: [`items.${index}.label`, `items.${index}.condition`, `items.${index}.componentId`],
  });
  const meta = INSPECTION_CONDITION_META[condition];
  const flagged = FLAGGED_CONDITIONS.includes(condition);
  const name = label || "item";

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-lg border bg-muted/40 p-3.5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Controller
          control={control}
          name={`items.${index}.label`}
          render={({ field, fieldState }) => (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Input
                {...field}
                aria-label="What was checked"
                aria-invalid={fieldState.invalid}
                placeholder="What was checked"
                maxLength={80}
                className="h-8 border-transparent bg-transparent px-1.5 font-medium shadow-none hover:border-input dark:bg-transparent"
              />
              <FieldError errors={[fieldState.error]} />
            </div>
          )}
        />
        <div className="flex items-center gap-1.5">
          <Controller
            control={control}
            name={`items.${index}.condition`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  ref={field.ref}
                  size="sm"
                  aria-label={`Condition of ${name}`}
                  className={cn("w-36 font-medium", TONE_SOFT[meta.tone])}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(InspectionCondition).map((value) => (
                    <SelectItem key={value} value={value}>
                      <span className={TONE_TEXT[INSPECTION_CONDITION_META[value].tone]}>
                        {INSPECTION_CONDITION_META[value].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
          >
            <X />
          </Button>
        </div>
      </div>
      <Controller
        control={control}
        name={`items.${index}.notes`}
        render={({ field }) => (
          <Input
            {...field}
            aria-label={`Notes on ${name}`}
            placeholder="Notes (optional)"
            maxLength={300}
            className="h-8 bg-card"
          />
        )}
      />
      {(flagged || componentId) && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <FormField
            control={control}
            name={`items.${index}.recommendedAction`}
            label="Recommended action"
            optional
            render={(field) => <Input {...field} maxLength={200} className="h-8 bg-card" />}
          />
          {components.length > 0 && (
            <FormField
              control={control}
              name={`items.${index}.componentId`}
              label="Component"
              optional
              render={(field) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                >
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    size="sm"
                    className="w-full bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {components.map((part) => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
