import { type ExpenseCategory, FUEL_CATEGORY_KEY } from "@automate/shared";
import { cn } from "cn";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SectionHeader } from "@/components/common/section-header";
import { ErrorState } from "@/components/feedback/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryDialog } from "@/features/expenses/components/category-dialog";
import { CategoryIcon } from "@/features/expenses/components/category-icon";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { COST_CLASS_TEXT } from "@/features/expenses/constants";
import {
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from "@/features/expenses/hooks/use-expenses";
import { formatNumber } from "@/utils/format";

const uses = (count: number) => `${formatNumber(count)} ${count === 1 ? "expense" : "expenses"}`;

/**
 * Stitch "Expenses — Categories": the system categories (read-only), then yours, which can be
 * renamed, disabled (kept for history, hidden from new expenses) or deleted while unused.
 */
export function Component() {
  const categories = useExpenseCategories();
  const update = useUpdateExpenseCategory();
  const remove = useDeleteExpenseCategory();
  const [dialog, setDialog] = useState<{ editing?: ExpenseCategory } | null>(null);
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null);

  const all = categories.data ?? [];
  const system = all.filter((category) => !category.custom);
  const mine = all.filter((category) => category.custom);
  const parents = all.filter((category) => category.active && category.key !== FUEL_CATEGORY_KEY);
  // A system category can hold your own subcategories: list them under "Your categories" too.
  const mineUnderSystem = system.flatMap((category) =>
    category.subcategories
      .filter((item) => item.custom)
      .map((item) => ({ ...item, parentName: category.name })),
  );

  const customActions = (category: ExpenseCategory) => (
    <div className="flex items-center gap-1">
      <Switch
        aria-label={`${category.active ? "Disable" : "Enable"} ${category.name}`}
        checked={category.active}
        onCheckedChange={(active) => update.mutate({ id: category.id, values: { active } })}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit ${category.name}`}
        onClick={() => setDialog({ editing: category })}
      >
        <Pencil />
      </Button>
      {category.usage > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="ghost" size="icon" aria-label={`Delete ${category.name}`} disabled>
                <Trash2 />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>In use by {uses(category.usage)}. Disable it instead.</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${category.name}`}
          onClick={() => setDeleting(category)}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );

  return (
    <ExpensesLayout
      tab="categories"
      actions={
        <Button variant="outline" onClick={() => setDialog({})}>
          <Plus data-icon="inline-start" />
          Add category
        </Button>
      }
    >
      {categories.isError ? (
        <ErrorState
          title="Couldn't load categories"
          error={categories.error}
          onRetry={() => void categories.refetch()}
        />
      ) : categories.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Built-in categories"
              description="Every account has these. They can't be changed."
            />
            <ul className="grid gap-4 lg:grid-cols-2">
              {system.map((category) => (
                <CategoryCard key={category.id} category={category} badge="System" />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Your categories"
              description="Add your own; disable one you no longer use, delete one you never used."
            />
            {mine.length === 0 && mineUnderSystem.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No custom categories yet.{" "}
                <Button variant="link" className="h-auto p-0" onClick={() => setDialog({})}>
                  Add one
                </Button>
              </p>
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {mine.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    actions={customActions(category)}
                  />
                ))}
                {mineUnderSystem.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    caption={`Subcategory of ${category.parentName}`}
                    actions={customActions(category)}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {dialog && (
        <CategoryDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          categories={parents}
          editing={dialog.editing}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="It isn't used by any expense. Its subcategories go with it. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
        }}
      />
    </ExpensesLayout>
  );
}

function CategoryCard({
  category,
  badge,
  caption,
  actions,
}: {
  category: ExpenseCategory;
  badge?: string;
  caption?: string;
  actions?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        !category.active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {category.name}
            {badge && (
              <Badge variant="outline" className="text-muted-foreground">
                {badge}
              </Badge>
            )}
            {!category.active && <Badge variant="outline">Disabled</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {caption ?? COST_CLASS_TEXT[category.costClass].label} · {uses(category.usage)}
          </p>
        </div>
        {actions}
      </div>
      {category.subcategories.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${category.name} subcategories`}>
          {category.subcategories.map((item) => (
            <li key={item.id}>
              <Badge variant="secondary" className={cn(!item.active && "opacity-60")}>
                {item.name}
                {item.usage > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    {" "}
                    · {formatNumber(item.usage)}
                  </span>
                )}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
