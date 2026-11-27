import { type Expense, ExpenseKind } from "@automate/shared";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";

import { CategoryIcon } from "./category-icon";

/** Icon, title and category (Stitch "Title & category"), plus the loan split for EMIs. */
export function ExpenseTitle({ expense, meta }: { expense: Expense; meta?: string }) {
  const category = [expense.category.name, expense.subcategory?.name].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CategoryIcon category={expense.subcategory ?? expense.category} size="sm" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{expense.title}</span>
          {expense.kind === ExpenseKind.REFUND && (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              Refund
            </Badge>
          )}
          {expense.shared && (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              Shared · {expense.shared.vehicleCount}
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {meta ? `${category} · ${meta}` : category}
        </p>
        {expense.finance && (
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            Principal {formatCurrency(expense.finance.principal ?? "0")} · Interest{" "}
            {formatCurrency(expense.finance.interest ?? "0")}
          </p>
        )}
      </div>
    </div>
  );
}
