import {
  CostClass,
  createExpenseCategorySchema,
  EXPENSE_ICONS,
  type ExpenseCategory,
  type ExpenseIcon,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Control, type Resolver, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { COST_CLASS_TEXT, EXPENSE_ICON_COMPONENTS } from "@/features/expenses/constants";
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
} from "@/features/expenses/hooks/use-expenses";
import { applyServerErrors } from "@/lib/forms";

import { Segmented } from "./segmented";

type CategoryForm = {
  name: string;
  icon: ExpenseIcon;
  level: "main" | "sub";
  parentId: string;
  costClass: CostClass | "";
};

/** The form's shape → the shared create schema (a subcategory inherits its parent's cost class). */
const formSchema = z
  .object({
    name: z.string(),
    icon: z.string(),
    level: z.enum(["main", "sub"]),
    parentId: z.string(),
    costClass: z.string(),
  })
  .transform((value): z.input<typeof createExpenseCategorySchema> =>
    value.level === "sub"
      ? // The pipe below validates these; the casts only satisfy its input type.
        { name: value.name, icon: value.icon as ExpenseIcon, parentId: value.parentId || undefined }
      : {
          name: value.name,
          icon: value.icon as ExpenseIcon,
          costClass: (value.costClass || undefined) as CostClass | undefined,
        },
  )
  .pipe(createExpenseCategorySchema);

/**
 * Stitch "Add Category Dialog": a custom category or subcategory with an icon from the set.
 * Editing a custom one changes only its name and icon (its place and cost type stay).
 */
export function CategoryDialog({
  open,
  onOpenChange,
  categories,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Possible parents (top-level, active, not Fuel). */
  categories: ExpenseCategory[];
  editing?: ExpenseCategory;
}) {
  const create = useCreateExpenseCategory();
  const update = useUpdateExpenseCategory();
  const form = useForm<CategoryForm, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema) as unknown as Resolver<
      CategoryForm,
      unknown,
      z.output<typeof formSchema>
    >,
    defaultValues: {
      name: editing?.name ?? "",
      icon: editing?.icon ?? "circle-dot",
      level: editing?.parentId ? "sub" : "main",
      parentId: editing?.parentId ?? "",
      costClass: editing?.parentId ? "" : (editing?.costClass ?? ""),
    },
  });
  const control = form.control as unknown as Control<CategoryForm>;
  const level = useWatch({ control, name: "level" });
  const { isSubmitting, errors } = form.formState;
  const [closing, setClosing] = useState(false);

  const submit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          values: { name: values.name, icon: values.icon },
        });
      } else {
        await create.mutateAsync(values);
      }
      setClosing(true);
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={open && !closing} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename it or pick another icon. Its expenses keep it."
              : "Your own category or subcategory, next to the built-in ones."}
          </DialogDescription>
        </DialogHeader>
        <form id="category-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={control}
            name="name"
            label="Name"
            render={(field) => <Input {...field} placeholder="Driver salary" className="h-10" />}
          />
          {!editing && (
            <FormField
              control={control}
              name="level"
              label="Type"
              render={(field) => (
                // A wrapper: the field stretches its direct children (`*:w-full`).
                <div>
                  <Segmented
                    aria-labelledby={`${field.id}-label`}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "main", label: "Main category" },
                      { value: "sub", label: "Subcategory of…" },
                    ]}
                  />
                </div>
              )}
            />
          )}
          {!editing && level === "sub" && (
            <FormField
              control={control}
              name="parentId"
              label="Parent category"
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {!editing && level === "main" && (
            <FormField
              control={control}
              name="costClass"
              label="Cost type"
              description="Decides where it counts: running cost (cost per km), ownership cost, loan or upgrade."
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue placeholder="Choose a cost type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CostClass).map((value) => (
                      <SelectItem key={value} value={value}>
                        {COST_CLASS_TEXT[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          <FormField
            control={control}
            name="icon"
            label="Icon"
            render={(field) => (
              <ToggleGroup
                type="single"
                aria-labelledby={`${field.id}-label`}
                value={field.value}
                onValueChange={(icon) => icon && field.onChange(icon)}
                // Six across on phones keeps every tile at least 40 px.
                className="grid w-full grid-cols-6 gap-2 sm:grid-cols-8"
              >
                {EXPENSE_ICONS.map((icon) => {
                  const Icon = EXPENSE_ICON_COMPONENTS[icon];
                  return (
                    <ToggleGroupItem
                      key={icon}
                      value={icon}
                      variant="outline"
                      aria-label={icon.replace(/-/g, " ")}
                      className="aspect-square h-auto min-h-10 w-full text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:text-primary data-[state=on]:ring-1 data-[state=on]:ring-primary"
                    >
                      <Icon className="size-4" aria-hidden />
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {editing ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
