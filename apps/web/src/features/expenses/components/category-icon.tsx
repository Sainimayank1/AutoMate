import type { ExpenseCategoryRef } from "@automate/shared";
import { cn } from "cn";

import { categoryTone, EXPENSE_ICON_COMPONENTS } from "@/features/expenses/constants";

/** A category's icon in its fixed colour, on a small tile (lists, pickers, the details sheet). */
export function CategoryIcon({
  category,
  size = "md",
  className,
}: {
  category: Pick<ExpenseCategoryRef, "key" | "icon">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = EXPENSE_ICON_COMPONENTS[category.icon] ?? EXPENSE_ICON_COMPONENTS["circle-dot"];
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border bg-muted",
        size === "sm" && "size-7 [&>svg]:size-3.5",
        size === "md" && "size-9 [&>svg]:size-4",
        size === "lg" && "size-12 [&>svg]:size-6",
        categoryTone(category),
        className,
      )}
    >
      <Icon />
    </span>
  );
}
