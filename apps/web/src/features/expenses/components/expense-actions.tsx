import { type Expense, ExpenseKind } from "@automate/shared";
import { Copy, EllipsisVertical, Eye, Pencil, Trash2, Undo2 } from "lucide-react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canRefund, sourceHref } from "@/features/expenses/utils/expense-helpers";
import { formatDate } from "@/utils/format";

export function ExpenseActions({
  expense,
  onDelete,
  onRefund,
}: {
  expense: Expense;
  onDelete: () => void;
  onRefund: () => void;
}) {
  const { search } = useLocation();
  const origin = sourceHref(expense);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${expense.title}, ${formatDate(expense.date)}`}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={{ pathname: `/expenses/transactions/${expense.id}`, search }}>
            <Eye />
            View details
          </Link>
        </DropdownMenuItem>
        {expense.editable && expense.kind === ExpenseKind.EXPENSE && (
          <DropdownMenuItem asChild>
            <Link to={`/expenses/${expense.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </DropdownMenuItem>
        )}
        {origin && (
          <DropdownMenuItem asChild>
            <Link to={origin}>
              <Pencil />
              Edit in Fuel
            </Link>
          </DropdownMenuItem>
        )}
        {expense.editable && expense.kind === ExpenseKind.EXPENSE && (
          <DropdownMenuItem asChild>
            <Link to={`/expenses/new?from=${expense.id}`}>
              <Copy />
              Duplicate
            </Link>
          </DropdownMenuItem>
        )}
        {canRefund(expense) && (
          <DropdownMenuItem onSelect={onRefund}>
            <Undo2 />
            Record refund
          </DropdownMenuItem>
        )}
        {expense.editable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
