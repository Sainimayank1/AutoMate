import {
  type Budget,
  BudgetPeriod,
  createBudgetSchema,
  type CreateBudgetValues,
  type ExpenseCategory,
  type Vehicle,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type Control, type Resolver, useForm } from "react-hook-form";
import { z } from "zod";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useCreateBudget, useUpdateBudget } from "@/features/expenses/hooks/use-budgets";
import { vehicleName } from "@/features/garage/constants";
import { applyServerErrors } from "@/lib/forms";

/** Radix Select can't hold an empty value: this one stands for "no category". */
const EVERYTHING = "everything";

type BudgetForm = {
  vehicleId: string;
  categoryId: string;
  period: BudgetPeriod;
  amount: string;
  alertPercent: string;
};

/** "Everything" in the select is no category. */
const formSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && "categoryId" in value && value.categoryId === EVERYTHING
      ? { ...value, categoryId: null }
      : value,
  createBudgetSchema,
  // The resolver needs the form's own input type; the shared schema checks the values.
) as unknown as z.ZodType<CreateBudgetValues, BudgetForm>;
type BudgetValues = CreateBudgetValues;

const trim = (value: string) => value.replace(/\.00$/, "");

/**
 * Stitch "Add Budget Dialog": a monthly or yearly limit for a vehicle, overall or for one main
 * category. Editing changes the limit, period and alert; the vehicle and category stay.
 */
export function BudgetDialog({
  open,
  onOpenChange,
  vehicles,
  categories,
  vehicleId,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  /** Main categories, active ones. */
  categories: ExpenseCategory[];
  /** The vehicle in scope, preselected. */
  vehicleId: string | undefined;
  editing?: Budget;
}) {
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const form = useForm<BudgetForm, unknown, BudgetValues>({
    resolver: zodResolver(formSchema) as unknown as Resolver<BudgetForm, unknown, BudgetValues>,
    defaultValues: {
      vehicleId: editing?.vehicleId ?? vehicleId ?? "",
      categoryId: editing ? (editing.category?.id ?? EVERYTHING) : EVERYTHING,
      period: editing?.period ?? BudgetPeriod.MONTH,
      amount: editing ? trim(editing.amount) : "",
      alertPercent: String(editing?.alertPercent ?? 80),
    },
  });
  const control = form.control as unknown as Control<BudgetForm>;
  const { isSubmitting, errors } = form.formState;
  const [closing, setClosing] = useState(false);

  const submit = form.handleSubmit(async ({ period, amount, alertPercent, ...rest }) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, values: { period, amount, alertPercent } });
      } else {
        await create.mutateAsync({ ...rest, period, amount, alertPercent });
      }
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
          <DialogTitle>{editing ? "Edit budget" : "Add budget"}</DialogTitle>
          <DialogDescription>
            A limit per month or year. Spending counts refunds off and loan principal out.
          </DialogDescription>
        </DialogHeader>
        <form id="budget-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={control}
            name="vehicleId"
            label="Vehicle"
            render={(field) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!editing}>
                <SelectTrigger
                  ref={field.ref}
                  id={field.id}
                  aria-invalid={field["aria-invalid"]}
                  className="w-full data-[size=default]:h-10"
                >
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicleName(vehicle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={control}
            name="categoryId"
            label="Category"
            render={(field) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!!editing}>
                <SelectTrigger
                  ref={field.ref}
                  id={field.id}
                  aria-invalid={field["aria-invalid"]}
                  className="w-full data-[size=default]:h-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EVERYTHING}>Everything on this vehicle</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FormField
            control={control}
            name="period"
            label="Period"
            render={(field) => (
              // A wrapper: the field stretches its direct children (`*:w-full`).
              <div>
                <Segmented
                  aria-labelledby={`${field.id}-label`}
                  className="grid w-full grid-cols-2"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: BudgetPeriod.MONTH, label: "Monthly" },
                    { value: BudgetPeriod.YEAR, label: "Yearly" },
                  ]}
                />
              </div>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="amount"
              label="Limit"
              render={(field) => (
                <NumberInput {...field} prefix="₹" decimals={2} placeholder="8000" />
              )}
            />
            <FormField
              control={control}
              name="alertPercent"
              label="Warn me at"
              description="Of the limit spent"
              render={(field) => <NumberInput {...field} suffix="%" decimals={0} />}
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="budget-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {editing ? "Save changes" : "Save budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
