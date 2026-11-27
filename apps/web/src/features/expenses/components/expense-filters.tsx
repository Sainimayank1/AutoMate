import { type ExpenseCategory, ExpenseSort, ExpenseSource, type Vehicle } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";

import { DatePicker } from "@/components/common/date-picker";
import { NumberInput } from "@/components/common/number-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SOURCE_LABELS } from "@/features/expenses/constants";
import {
  ALL_VEHICLES,
  type useExpenseFilters,
} from "@/features/expenses/hooks/use-expense-filters";
import { PAYMENT_METHOD_LABELS } from "@/features/fuel/constants";
import { vehicleName } from "@/features/garage/constants";

import { CategorySelect } from "./category-select";

type Filters = ReturnType<typeof useExpenseFilters>;

const SORT_LABELS: Record<ExpenseSort, string> = {
  [ExpenseSort.DATE_DESC]: "Newest first",
  [ExpenseSort.DATE_ASC]: "Oldest first",
  [ExpenseSort.AMOUNT_DESC]: "Highest amount",
  [ExpenseSort.AMOUNT_ASC]: "Lowest amount",
};

function Control({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

const day = (value: string | undefined) => (value ? parseISO(value) : undefined);
const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : undefined);

/** The filter controls; inline on wide screens, in a sheet on phones (Stitch "Expenses — Transactions"). */
function FilterControls({
  filters,
  vehicles,
  categories,
}: {
  filters: Filters;
  vehicles: Vehicle[];
  categories: ExpenseCategory[];
}) {
  const { get, set } = filters;
  const select = (key: "payment" | "source", options: Record<string, string>, all: string) => (
    <Select
      value={get(key) ?? "any"}
      onValueChange={(value) => set(key, value === "any" ? undefined : value)}
    >
      <SelectTrigger id={`filter-${key}`} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">{all}</SelectItem>
        {Object.entries(options).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      <Control label="Vehicle" id="filter-vehicle">
        <Select value={filters.vehicle} onValueChange={(value) => set("vehicle", value)}>
          <SelectTrigger id="filter-vehicle" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Control>
      <Control label="From" id="filter-from">
        <DatePicker
          id="filter-from"
          value={day(get("from"))}
          onChange={(date) => set("from", iso(date))}
          placeholder="Any date"
        />
      </Control>
      <Control label="To" id="filter-to">
        <DatePicker
          id="filter-to"
          value={day(get("to"))}
          onChange={(date) => set("to", iso(date))}
          placeholder="Any date"
        />
      </Control>
      <Control label="Category" id="filter-category">
        <CategorySelect
          id="filter-category"
          className="w-full"
          categories={categories}
          value={get("category")}
          onChange={(value) => set("category", value)}
          allLabel="All categories"
        />
      </Control>
      <Control label="Payment" id="filter-payment">
        {select("payment", PAYMENT_METHOD_LABELS, "Any payment")}
      </Control>
      <Control label="Source" id="filter-source">
        {select(
          "source",
          Object.fromEntries(
            Object.values(ExpenseSource).map((value) => [value, SOURCE_LABELS[value]]),
          ),
          "All sources",
        )}
      </Control>
      <Control label="Amount from" id="filter-min">
        <NumberInput
          id="filter-min"
          prefix="₹"
          decimals={2}
          value={get("min") ?? ""}
          onChange={(value) => set("min", value)}
        />
      </Control>
      <Control label="Amount to" id="filter-max">
        <NumberInput
          id="filter-max"
          prefix="₹"
          decimals={2}
          value={get("max") ?? ""}
          onChange={(value) => set("max", value)}
        />
      </Control>
    </div>
  );
}

export function SortSelect({ filters }: { filters: Filters }) {
  return (
    <Select
      value={filters.get("sort") ?? ExpenseSort.DATE_DESC}
      onValueChange={(value) =>
        filters.set("sort", value === ExpenseSort.DATE_DESC ? undefined : value)
      }
    >
      <SelectTrigger aria-label="Sort" className="h-9 w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(ExpenseSort).map((value) => (
          <SelectItem key={value} value={value}>
            {SORT_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExpenseFilters(props: {
  filters: Filters;
  vehicles: Vehicle[];
  categories: ExpenseCategory[];
}) {
  const clear = props.filters.narrowed && (
    <Button variant="ghost" size="sm" onClick={props.filters.clear}>
      <X data-icon="inline-start" />
      Clear filters
    </Button>
  );
  return (
    <>
      <div className="flex flex-col gap-2 max-md:hidden">
        <FilterControls {...props} />
        {clear && <div className="flex justify-end">{clear}</div>}
      </div>
      <div className="flex items-center gap-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal data-icon="inline-start" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the list; changes apply right away.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <FilterControls {...props} />
            </div>
          </SheetContent>
        </Sheet>
        {clear}
      </div>
    </>
  );
}
