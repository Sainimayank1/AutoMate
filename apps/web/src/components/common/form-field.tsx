import { type ReactNode, useId } from "react";
import {
  type Control,
  Controller,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

type FormFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  control: Control<T>;
  name: N;
  label: string;
  /** Adds a quiet "(optional)" to the label, so the accessible name says it too. */
  optional?: boolean;
  description?: ReactNode;
  /** Render the input; spread the given props onto it. */
  render: (
    field: ControllerRenderProps<T, N> & { id: string; "aria-invalid": boolean },
  ) => ReactNode;
};

/** Label + input + description + validation error for one react-hook-form field. */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  optional,
  description,
  render,
}: FormFieldProps<T, N>) {
  const id = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          {/* The id names groups that can't use htmlFor (radio groups: aria-labelledby). */}
          <FieldLabel id={`${id}-label`} htmlFor={id}>
            {label}
            {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
          </FieldLabel>
          {render({ ...field, id, "aria-invalid": fieldState.invalid })}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
