import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  type DateWindow,
  EARLIEST_PERIOD_DATE,
  ReportingPeriod,
  type Vehicle,
} from "@automate/shared";
import { format, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { DatePicker } from "@/components/common/date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { greeting, PERIOD_LABELS } from "@/features/dashboard/constants";
import type { useDashboardPeriod } from "@/features/dashboard/hooks/use-dashboard-period";
import { vehicleName } from "@/features/garage/constants";
import { useSessionStore } from "@/stores/session-store";
import { formatRegistration } from "@/utils/format";

/** Records start in 2000 (the API's limit too). */
const EARLIEST = parseISO(EARLIEST_PERIOD_DATE);
const iso = (date: Date | undefined) => (date ? format(date, "yyyy-MM-dd") : undefined);
const day = (value: string | undefined) => (value ? parseISO(value) : undefined);

/** The greeting and today's date (Stitch "Dashboard": "Good afternoon, Arjun · 27 Nov 2026"). */
export function DashboardGreeting({ children }: { children?: React.ReactNode }) {
  const name = useSessionStore((state) => state.session?.user.name.split(" ")[0]);
  const now = new Date();
  return (
    <section className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(now)}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {format(now, "d MMM yyyy")} · Your vehicle ownership overview
        </p>
      </div>
      {children}
    </section>
  );
}

/**
 * Stitch "Dashboard" header controls: the vehicle (the app's active vehicle, shared with the
 * sidebar switcher), the period, refresh and `children` (Customise). A custom period shows its two
 * dates.
 */
export function DashboardControls({
  vehicles,
  vehicleId,
  onVehicleChange,
  period,
  shown,
  refreshing,
  onRefresh,
  children,
}: {
  vehicles: Vehicle[];
  vehicleId: string;
  onVehicleChange: (id: string) => void;
  period: ReturnType<typeof useDashboardPeriod>;
  /** The window on screen: a new custom range starts from it. */
  shown?: DateWindow;
  refreshing: boolean;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  const custom = period.period === ReportingPeriod.CUSTOM;
  const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
  return (
    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
      <Select value={vehicleId} onValueChange={onVehicleChange}>
        <SelectTrigger
          aria-label="Vehicle"
          className="min-w-28 flex-1 max-md:data-[size=default]:h-10 sm:w-80 sm:flex-none"
        >
          {/* A compact chip on phones (Stitch mobile): the model; the full name and plate above. */}
          <SelectValue>
            {selected && (
              <>
                <span className="truncate sm:hidden">{selected.model}</span>
                <span className="hidden truncate sm:inline">
                  {vehicleName(selected)} · {formatRegistration(selected.registrationNumber)}
                </span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {vehicles.map((vehicle) => (
            <SelectItem key={vehicle.id} value={vehicle.id}>
              {vehicleName(vehicle)} · {formatRegistration(vehicle.registrationNumber)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={period.period}
        onValueChange={(next) => period.setPeriod(next as DashboardPeriod, shown)}
      >
        <SelectTrigger
          aria-label="Period"
          className="w-auto max-md:data-[size=default]:h-10 sm:w-40"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DASHBOARD_PERIODS.map((value) => (
            <SelectItem key={value} value={value}>
              {PERIOD_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {custom && (
        <div className="flex w-full items-center gap-2 max-md:[&_button]:h-10 sm:w-auto">
          <div className="flex-1 sm:w-40">
            <Label htmlFor="dashboard-from" className="sr-only">
              Start date
            </Label>
            <DatePicker
              id="dashboard-from"
              value={day(period.from)}
              onChange={(date) => period.setRange({ from: iso(date) })}
              disabledDates={[{ before: EARLIEST }, { after: day(period.to) ?? new Date() }]}
              placeholder="From"
            />
          </div>
          <span className="text-sm text-muted-foreground">to</span>
          <div className="flex-1 sm:w-40">
            <Label htmlFor="dashboard-to" className="sr-only">
              End date
            </Label>
            <DatePicker
              id="dashboard-to"
              value={day(period.to)}
              onChange={(date) => period.setRange({ to: iso(date) })}
              disabledDates={[
                ...(period.from ? [{ before: day(period.from)! }] : []),
                { after: new Date() },
              ]}
              placeholder="To"
            />
          </div>
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="aria-disabled:opacity-50 max-md:size-10"
            aria-label="Refresh dashboard"
            // aria-disabled, not disabled: the button keeps focus while it refreshes.
            onClick={() => !refreshing && onRefresh()}
            aria-disabled={refreshing}
          >
            <RefreshCw
              className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}
