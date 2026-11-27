import { type ExpenseCategory, ExpenseSort, ExpenseSource, type Vehicle } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

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
          disabledDates={day(get("to")) && { after: day(get("to"))! }}
          placeholder="Any date"
        />
      </Control>
      <Control label="To" id="filter-to">
        <DatePicker
          id="filter-to"
          value={day(get("to"))}
          onChange={(date) => set("to", iso(date))}
          disabledDates={day(get("from")) && { before: day(get("from"))! }}
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
        <AmountFilter id="filter-min" value={get("min")} onCommit={(value) => set("min", value)} />
      </Control>
      <Control label="Amount to" id="filter-max">
        <AmountFilter id="filter-max" value={get("max")} onCommit={(value) => set("max", value)} />
      </Control>
    </div>
  );
}

const AMOUNT_DELAY_MS = 400;

/** An amount bound, sent once typing pauses (not one request per keystroke). */
function AmountFilter({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");
  // Cleared from outside ("Clear filters"): empty the box too.
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (value === undefined) setText("");
  }
  useEffect(() => {
    if (text === (value ?? "")) return;
    const timer = setTimeout(() => onCommit(text || undefined), AMOUNT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce on the text only
  return <NumberInput id={id} prefix="₹" decimals={2} value={text} onChange={setText} />;
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
