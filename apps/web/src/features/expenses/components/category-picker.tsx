import { type ExpenseCategory, FUEL_CATEGORY_KEY } from "@automate/shared";
import { cn } from "cn";
import { useState } from "react";
import { Link } from "react-router";

import { SearchInput } from "@/components/common/search-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { CategoryIcon } from "./category-icon";

type Choice = { categoryId: string; subcategoryId: string };

/**
 * Stitch "Add Expense" §2: search, recent picks, a grid of category tiles (the chosen one gets
 * the ice-blue ring) and the subcategory. Fuel is shown but sends you to Fuel: fuel expenses
 * come from fill-ups, never typed twice.
 */
export function CategoryPicker({
  categories,
  recent,
  value,
  onChange,
  invalid,
}: {
  categories: ExpenseCategory[];
  /** Recently used (subcategory or category), newest first. */
  recent: Choice[];
  value: Choice;
  onChange: (choice: Choice) => void;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const active = categories.filter((category) => category.active);
  const needle = query.trim().toLowerCase();
  const matches = (name: string) => name.toLowerCase().includes(needle);
  const shown = active.filter(
    (category) =>
      !needle ||
      matches(category.name) ||
      category.subcategories.some((item) => matches(item.name)),
  );
  const selected = active.find((category) => category.id === value.categoryId);
  const subcategories = selected?.subcategories.filter((item) => item.active) ?? [];
  const label = (choice: Choice) => {
    const category = categories.find((item) => item.id === choice.categoryId);
    const sub = category?.subcategories.find((item) => item.id === choice.subcategoryId);
    return sub?.name ?? category?.name;
  };

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search categories"
        aria-label="Search categories"
        className="h-10"
      />
      {recent.length > 0 && !needle && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Recent</span>
          {recent.map((choice) => (
            <Button
              key={`${choice.categoryId}:${choice.subcategoryId}`}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={
                value.categoryId === choice.categoryId &&
                value.subcategoryId === choice.subcategoryId
              }
              onClick={() => onChange(choice)}
            >
              {label(choice)}
            </Button>
          ))}
        </div>
      )}
      <ToggleGroup
        type="single"
        aria-label="Category"
        aria-invalid={invalid}
        value={value.categoryId}
        onValueChange={(categoryId) => categoryId && onChange({ categoryId, subcategoryId: "" })}
        className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {shown
          .filter((category) => category.key !== FUEL_CATEGORY_KEY)
          .map((category) => (
            <ToggleGroupItem
              key={category.id}
              value={category.id}
              variant="outline"
              className={cn(
                "h-auto justify-start gap-2 bg-card p-3 text-left font-normal whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:ring-1 data-[state=on]:ring-primary",
                invalid && !value.categoryId && "border-destructive",
              )}
            >
              <CategoryIcon category={category} size="sm" />
              <span className="min-w-0 leading-tight">{category.name}</span>
            </ToggleGroupItem>
          ))}
      </ToggleGroup>
      {shown
        .filter((category) => category.key === FUEL_CATEGORY_KEY)
        .map((category) => (
          // Fuel isn't a choice here: fuel expenses come from fill-ups.
          <Link
            key={category.id}
            to="/fuel/new"
            className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <CategoryIcon category={category} size="sm" />
            <span className="min-w-0">
              {category.name} <span className="text-xs text-primary">· Log in Fuel</span>
            </span>
          </Link>
        ))}
      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground">No category matches “{query}”.</p>
      )}
      {selected && subcategories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="expense-subcategory" className="text-sm font-medium">
            Subcategory <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Select
            value={value.subcategoryId || "none"}
            onValueChange={(subcategoryId) =>
              onChange({
                categoryId: selected.id,
                subcategoryId: subcategoryId === "none" ? "" : subcategoryId,
              })
            }
          >
            <SelectTrigger id="expense-subcategory" className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No subcategory</SelectItem>
              {subcategories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
