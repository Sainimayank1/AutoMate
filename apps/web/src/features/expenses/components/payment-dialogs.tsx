import {
  PaymentMethod,
  payRecurringSchema,
  type PayRecurringValues,
  postponeRecurringSchema,
  type PostponeRecurringValues,
  type RecurringPayment,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import { type Control, type Resolver, useForm } from "react-hook-form";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { NumberInput } from "@/components/common/number-input";
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
import { Textarea } from "@/components/ui/textarea";
import { usePayRecurring, usePostponePayment } from "@/features/expenses/hooks/use-recurring";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { applyServerErrors } from "@/lib/forms";
import { formatCurrency, formatDate } from "@/utils/format";

type PayForm = {
  date: string;
  amount: string;
  chargesAmount: string;
  paymentMethod: PaymentMethod | "";
  notes: string;
};

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * Stitch "Record Payment": marking a due date paid records its expense (once). A loan EMI's
 * amount and split come from the loan's schedule; only late fees can be added, as charges.
 */
export function RecordPaymentDialog({
  payment,
  onOpenChange,
}: {
  payment: RecurringPayment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const pay = usePayRecurring();
  const form = useForm<PayForm, unknown, PayRecurringValues>({
    resolver: zodResolver(payRecurringSchema) as unknown as Resolver<
      PayForm,
      unknown,
      PayRecurringValues
    >,
    values: {
      date: iso(new Date()),
      amount: payment && !payment.loan ? payment.amount.replace(/\.00$/, "") : "",
      chargesAmount: "",
      paymentMethod: "",
      notes: "",
    },
  });
  const { isSubmitting, errors } = form.formState;
  const control = form.control as unknown as Control<PayForm>;

  const submit = form.handleSubmit(async (values) => {
    if (!payment) return;
    try {
      await pay.mutateAsync({ id: payment.recurringId, dueDate: payment.dueDate, values });
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={!!payment} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {payment && (
              <>
                {payment.title}, due {formatDate(payment.dueDate)}.{" "}
                {payment.loan
                  ? `EMI ${payment.loan.number} of ${payment.loan.of}: ${formatCurrency(payment.loan.principal)} principal and ${formatCurrency(payment.loan.interest)} interest.`
                  : "It's saved as an expense."}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form id="pay-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          {payment?.loan ? (
            <FormField
              control={control}
              name="chargesAmount"
              label="Late fee or charges"
              optional
              description={`Added to the EMI of ${formatCurrency(payment.amount)}; a cost, not principal`}
              render={(field) => <NumberInput {...field} prefix="₹" decimals={2} placeholder="0" />}
            />
          ) : (
            <FormField
              control={control}
              name="amount"
              label="Amount paid"
              render={(field) => <NumberInput {...field} prefix="₹" decimals={2} />}
            />
          )}
          <FormField
            control={control}
            name="date"
            label="Paid on"
            render={(field) => (
              <DatePicker
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                value={field.value ? parseISO(field.value) : undefined}
                onChange={(date) => field.onChange(date ? iso(date) : "")}
                disabledDates={{ after: new Date() }}
              />
            )}
          />
          <FormField
            control={control}
            name="paymentMethod"
            label="Payment method"
            optional
            render={(field) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={field.id} ref={field.ref} className="h-10 w-full">
                  <SelectValue placeholder="As scheduled" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(PaymentMethod).map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
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
            render={(field) => <Textarea {...field} rows={2} />}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="pay-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Move a due date later; it stays the same payment (its original date is kept). */
export function PostponeDialog({
  payment,
  onOpenChange,
}: {
  payment: RecurringPayment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const postpone = usePostponePayment();
  const form = useForm<{ to: string }, unknown, PostponeRecurringValues>({
    resolver: zodResolver(postponeRecurringSchema),
    values: { to: payment ? iso(addDays(parseISO(payment.date), 7)) : "" },
  });
  const { isSubmitting, errors } = form.formState;

  const submit = form.handleSubmit(async ({ to }) => {
    if (!payment) return;
    try {
      await postpone.mutateAsync({ id: payment.recurringId, dueDate: payment.dueDate, to });
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <Dialog open={!!payment} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Postpone payment</DialogTitle>
          <DialogDescription>
            {payment && `${payment.title}, due ${formatDate(payment.dueDate)}.`}
          </DialogDescription>
        </DialogHeader>
        <form id="postpone-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={errors.root?.server?.message} />
          <FormField
            control={form.control}
            name="to"
            label="New date"
            render={(field) => (
              <DatePicker
                ref={field.ref}
                id={field.id}
                aria-invalid={field["aria-invalid"]}
                value={field.value ? parseISO(field.value) : undefined}
                onChange={(date) => field.onChange(date ? iso(date) : "")}
                disabledDates={
                  payment ? { before: addDays(parseISO(payment.dueDate), 1) } : undefined
                }
              />
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="postpone-form" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Postpone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
