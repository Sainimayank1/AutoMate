import { MAINTENANCE_GROUPS, ServiceRecordType } from "@automate/shared";
import { format, parseISO } from "date-fns";
import { SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { DatePicker } from "@/components/common/date-picker";
import { NumberInput } from "@/components/common/number-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { GROUP_NAMES, RECORD_TYPE_LABELS } from "@/features/maintenance/constants";
import {
  HISTORY_FILTER_KEYS,
  type HistoryFilterKey,
  type useHistoryFilters,
} from "@/features/maintenance/hooks/use-history-filters";
import { useProviders } from "@/features/maintenance/hooks/use-maintenance";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrency, formatDate, formatDistance } from "@/utils/format";

type Filters = ReturnType<typeof useHistoryFilters>;
type Draft = Partial<Record<HistoryFilterKey, string>>;
const ALL = "all";

function Control({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** The filter fields, edited as a draft and applied together (Stitch "Service History"). */
function FilterFields({ draft, setDraft }: { draft: Draft; setDraft: (draft: Draft) => void }) {
  const providers = useProviders().data ?? [];
  const field = (key: HistoryFilterKey) => draft[key] ?? "";
  const update = (key: HistoryFilterKey, value: string) => setDraft({ ...draft, [key]: value });
  const date = (key: "from" | "to", label: string) => (
    <Control label={label} id={`history-${key}`}>
      <DatePicker
        id={`history-${key}`}
        value={field(key) ? parseISO(field(key)) : undefined}
        onChange={(value) => update(key, value ? format(value, "yyyy-MM-dd") : "")}
        placeholder="DD/MM/YYYY"
      />
    </Control>
  );
  const select = (
    key: "group" | "type" | "workshop",
    label: string,
    all: string,
    options: { value: string; label: string }[],
  ) => (
    <Control label={label} id={`history-${key}`}>
      <Select
        value={field(key) || ALL}
        onValueChange={(value) => update(key, value === ALL ? "" : value)}
      >
        <SelectTrigger id={`history-${key}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{all}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Control>
  );
  const number = (key: "min" | "max" | "minKm" | "maxKm", label: string, money: boolean) => (
    <Control label={label} id={`history-${key}`}>
      <NumberInput
        id={`history-${key}`}
        value={field(key)}
        onChange={(value) => update(key, value)}
        {...(money ? { prefix: "₹", decimals: 2 } : { suffix: "km" })}
        placeholder="0"
      />
    </Control>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {date("from", "From date")}
      {date("to", "To date")}
      {select(
        "group",
        "Category",
        "All categories",
        MAINTENANCE_GROUPS.map((group) => ({ value: group.key, label: group.name })),
      )}
      {select(
        "type",
        "Record type",
        "All types",
        Object.values(ServiceRecordType).map((type) => ({
          value: type,
          label: RECORD_TYPE_LABELS[type],
        })),
      )}
      <div className="sm:col-span-2">
        {select(
          "workshop",
          "Workshop",
          "All workshops",
          providers.map((provider) => ({ value: provider.id, label: provider.name })),
        )}
      </div>
      {number("min", "₹ min", true)}
      {number("max", "₹ max", true)}
      {number("minKm", "km min", false)}
      {number("maxKm", "km max", false)}
    </div>
  );
}

/**
 * Stitch "Service History" filters: a Filters button with the active count, opening a popover
 * (a bottom sheet on phones) with Clear and Apply. Everything is filtered by the API.
 */
export function HistoryFilters({ filters }: { filters: Filters }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const current = () =>
    Object.fromEntries(
      HISTORY_FILTER_KEYS.map((key) => [key, filters.params.get(key) ?? ""]),
    ) as Draft;
  const [draft, setDraft] = useState<Draft>(current);

  const toggle = (next: boolean) => {
    if (next) setDraft(current());
    setOpen(next);
  };
  const apply = () => {
    filters.set(
      Object.fromEntries(
        HISTORY_FILTER_KEYS.filter((key) => key !== "q").map((key) => [key, draft[key] || null]),
      ),
    );
    setOpen(false);
  };
  const clear = () => {
    filters.clear();
    setOpen(false);
  };

  const trigger = (
    <Button variant="outline" aria-label={`Filters, ${filters.active.length} active`}>
      <SlidersHorizontal data-icon="inline-start" />
      Filters
      {filters.active.length > 0 && (
        <Badge className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">{filters.active.length}</Badge>
      )}
    </Button>
  );
  const body = (
    <>
      <FilterFields draft={draft} setDraft={setDraft} />
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={clear}>
          Clear
        </Button>
        <Button onClick={apply}>Apply</Button>
      </div>
    </>
  );

  return mobile ? (
    <Sheet open={open} onOpenChange={toggle}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] gap-4 overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the service history.</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="flex w-[30rem] flex-col gap-4">
        {body}
      </PopoverContent>
    </Popover>
  );
}

/** The applied filters as removable chips. */
export function HistoryFilterChips({ filters }: { filters: Filters }) {
  const providers = useProviders().data ?? [];
  const { filters: applied } = filters;
  const chips: { label: string; keys: HistoryFilterKey[] }[] = [];
  if (applied.from || applied.to) {
    chips.push({
      label: `Date: ${applied.from ? formatDate(applied.from) : "…"} – ${applied.to ? formatDate(applied.to) : "…"}`,
      keys: ["from", "to"],
    });
  }
  if (applied.group)
    chips.push({ label: `Category: ${GROUP_NAMES[applied.group]}`, keys: ["group"] });
  if (applied.type)
    chips.push({ label: `Type: ${RECORD_TYPE_LABELS[applied.type]}`, keys: ["type"] });
  if (applied.providerId) {
    const name =
      providers.find((provider) => provider.id === applied.providerId)?.name ?? "Workshop";
    chips.push({ label: `Workshop: ${name}`, keys: ["workshop"] });
  }
  if (applied.minAmount || applied.maxAmount) {
    chips.push({
      label: `Cost: ${applied.minAmount ? formatCurrency(applied.minAmount) : "₹0"} – ${applied.maxAmount ? formatCurrency(applied.maxAmount) : "any"}`,
      keys: ["min", "max"],
    });
  }
  if (applied.minKm != null || applied.maxKm != null) {
    chips.push({
      label: `Odometer: ${applied.minKm != null ? formatDistance(applied.minKm) : "0 km"} – ${applied.maxKm != null ? formatDistance(applied.maxKm) : "any"}`,
      keys: ["minKm", "maxKm"],
    });
  }
  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.label}>
          <Badge variant="secondary" className="gap-1 pr-1">
            {chip.label}
            <button
              type="button"
              aria-label={`Remove ${chip.label}`}
              onClick={() => filters.set(Object.fromEntries(chip.keys.map((key) => [key, null])))}
              className="rounded-sm p-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3" aria-hidden />
            </button>
          </Badge>
        </li>
      ))}
    </ul>
  );
}
