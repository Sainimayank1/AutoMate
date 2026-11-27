import type { ExpenseCategory } from "@automate/shared";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * One select over the whole tree: a category, or one of its subcategories (indented).
 * `allLabel` adds an "any" option (filters); `only` limits which categories are offered.
 */
export function CategorySelect({
  categories,
  value,
  onChange,
  allLabel,
  only = () => true,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  categories: ExpenseCategory[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  allLabel?: string;
  only?: (category: ExpenseCategory) => boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      value={value ?? "any"}
      onValueChange={(next) => onChange(next === "any" ? undefined : next)}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder="Choose a category" />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="any">{allLabel}</SelectItem>}
        {categories.filter(only).map((category) => (
          <SelectGroup key={category.id}>
            <SelectLabel className="sr-only">{category.name}</SelectLabel>
            <SelectItem value={category.id} className="font-medium">
              {category.name}
              {!category.active && " (disabled)"}
            </SelectItem>
            {category.subcategories.map((item) => (
              <SelectItem key={item.id} value={item.id} className="pl-6">
                {item.name}
                {!item.active && " (disabled)"}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
