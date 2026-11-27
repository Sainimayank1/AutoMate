import {
  createRefundSchema,
  type CreateRefundValues,
  type Expense,
  RefundReason,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { type Control, type Resolver, useForm } from "react-hook-form";

import { DatePicker } from "@/components/common/date-picker";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { REFUND_REASON_LABELS } from "@/features/expenses/constants";
import { useRefundExpense } from "@/features/expenses/hooks/use-expenses";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency } from "@/utils/format";

type RefundForm = { amount: string; date: string; reason: RefundReason; notes: string };

/** Stitch "Add Refund Dialog": money back against an expense; the original is kept. */
export function RefundDialog({
  expense,
  remaining,
  open,
  onOpenChange,
}: {
  expense: Expense;
  /** What can still be refunded (amount − refunded so far), from the API. */
  remaining: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const refund = useRefundExpense(expense.id);
  const form = useForm<RefundForm, unknown, CreateRefundValues>({
    resolver: zodResolver(createRefundSchema) as unknown as Resolver<
      RefundForm,
      unknown,
      CreateRefundValues
    >,
    defaultValues: {
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      reason: RefundReason.REFUND,
      notes: "",
    },
  });
  const { isSubmitting, errors } = form.formState;
  // FormField reads the input values; the resolver's output type isn't its concern.
  const control = form.control as unknown as Control<RefundForm>;

  const submit = form.handleSubmit(async (values) => {
    try {
      await refund.mutateAsync(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a refund</DialogTitle>
          <DialogDescription>
            {expense.title} · {formatCurrency(expense.amount)}. The original expense is kept; net
            spending drops by the refunded amount.
          </DialogDescription>
        </DialogHeader>
        <form id="refund-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={control}
            name="amount"
            label="Amount"
            description={`Up to ${formatCurrency(remaining)} not yet refunded`}
            render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="200" />}
          />
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
                onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                disabledDates={{ before: parseISO(expense.date), after: new Date() }}
              />
            )}
          />
          <FormField
            control={control}
            name="reason"
            label="Reason"
            render={(field) => (
              <Segmented
                aria-labelledby={`${field.id}-label`}
                className="grid w-full grid-cols-3"
                value={field.value}
                onChange={field.onChange}
                options={Object.values(RefundReason).map((reason) => ({
                  value: reason,
                  label: REFUND_REASON_LABELS[reason],
                }))}
              />
            )}
          />
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => (
              <Textarea {...field} rows={2} placeholder="Returned the wrong part" />
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="refund-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Save refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
