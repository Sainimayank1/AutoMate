import {
  CostClass,
  createExpenseCategorySchema,
  EXPENSE_ICONS,
  type ExpenseCategory,
  type ExpenseIcon,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "cn";
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
import { COST_CLASS_TEXT, EXPENSE_ICON_COMPONENTS } from "@/features/expenses/constants";
import {
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
} from "@/features/expenses/hooks/use-expenses";
import { applyServerErrors } from "@/lib/forms";

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
                <div
                  role="radiogroup"
                  aria-labelledby={`${field.id}-label`}
                  className="inline-grid w-fit grid-flow-col gap-1 rounded-lg border bg-muted p-1"
                >
                  {(["main", "sub"] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === value}
                      variant={field.value === value ? "secondary" : "ghost"}
                      size="sm"
                      className={field.value === value ? "text-primary" : undefined}
                      onClick={() => field.onChange(value)}
                    >
                      {value === "main" ? "Main category" : "Subcategory of…"}
                    </Button>
                  ))}
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
              <div
                role="radiogroup"
                aria-labelledby={`${field.id}-label`}
                className="grid grid-cols-8 gap-2"
              >
                {EXPENSE_ICONS.map((icon) => {
                  const Icon = EXPENSE_ICON_COMPONENTS[icon];
                  return (
                    <button
                      key={icon}
                      type="button"
                      role="radio"
                      aria-checked={field.value === icon}
                      aria-label={icon.replace(/-/g, " ")}
                      onClick={() => field.onChange(icon)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg border text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                        field.value === icon &&
                          "border-primary bg-secondary text-primary ring-1 ring-primary",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </button>
                  );
                })}
              </div>
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
