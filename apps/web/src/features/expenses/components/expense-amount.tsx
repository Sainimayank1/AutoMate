import { type Expense, ExpenseKind } from "@automate/shared";
import { cn } from "cn";

import { formatCurrency } from "@/utils/format";

/** The amount as spent (refunds negative), with what explains it underneath. */
export function ExpenseAmount({ expense, className }: { expense: Expense; className?: string }) {
  const refund = expense.kind === ExpenseKind.REFUND;
  const notes = [
    expense.shared && `of ${formatCurrency(expense.shared.totalAmount)} shared`,
    Number(expense.refundedAmount) > 0 && `${formatCurrency(expense.refundedAmount)} refunded`,
  ].filter(Boolean);
  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <span className="font-medium tabular-nums">
        {refund ? "−" : ""}
        {formatCurrency(expense.amount)}
      </span>
      {notes.length > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">{notes.join(" · ")}</span>
      )}
    </div>
  );
}
