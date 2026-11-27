import type { DashboardMetrics, DateWindow, MetricFigure, PeriodWindow } from "@automate/shared";
import { cn } from "cn";
import {
  Fuel,
  Gauge,
  Info,
  type LucideIcon,
  Milestone,
  ReceiptIndianRupee,
  Route,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatCurrency,
  formatDateRange,
  formatDistance,
  formatEfficiency,
  formatNumber,
  formatVolume,
} from "@/utils/format";

/** How a change reads: a cost going up is a warning, mileage going up is good (color-system.md). */
type Direction = "cost" | "efficiency" | "neutral";

const signed = (text: string, negative: boolean, positive: boolean) =>
  `${positive ? "+" : negative ? "−" : ""}${text}`;

/** "+12% vs 1–27 Oct", or the absolute change ("+0.6 km/L vs …") when that reads better. */
function comparison(
  figure: MetricFigure,
  previous: DateWindow,
  direction: Direction,
  absolute?: (change: string) => string,
): { text: string; tone: string } | null {
  if (figure.change === null) return null;
  const value = Number(figure.change);
  const magnitude = figure.change.replace("-", "");
  const text = absolute
    ? signed(absolute(magnitude), value < 0, value > 0)
    : figure.changePercent === null
      ? null
      : signed(`${formatNumber(Math.abs(figure.changePercent))}%`, value < 0, value > 0);
  if (text === null) return null;
  const down = value < 0;
  const tone =
    value === 0 || direction === "neutral"
      ? "text-muted-foreground"
      : direction === "cost"
        ? down
          ? "text-success"
          : "text-warning"
        : down
          ? (figure.changePercent ?? 0) <= -10
            ? "text-warning"
            : "text-muted-foreground"
          : "text-success";
  return { text: `${text} vs ${formatDateRange(previous)}`, tone };
}

/**
 * Stitch "Dashboard" metric strip: the period's five core figures, each compared like for like,
 * each with its definition and a link to the module behind it. Every number comes from the API.
 */
export function MetricStrip({
  metrics,
  period,
}: {
  metrics: DashboardMetrics;
  period: PeriodWindow;
}) {
  const { spent, runningCostPerKm, mileage, distance, fuelSpend } = metrics;
  const previous = period.previous;
  const range = formatDateRange(period);
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <MetricCard
        label="Spent"
        icon={ReceiptIndianRupee}
        href="/expenses"
        info="Everything paid for this vehicle in the period, refunds subtracted. Loan principal isn't counted: it pays the loan down."
        value={formatCurrency(spent.value)}
        compared={comparison(spent, previous, "cost")}
        otherwise={
          spent.records
            ? `Nothing to compare with in ${formatDateRange(previous)}`
            : `Nothing recorded in ${range}`
        }
      />
      <MetricCard
        label="Running cost / km"
        icon={Gauge}
        href="/expenses"
        info="Running cost (fuel, servicing, repairs, tolls, parking, washing) ÷ km driven, from odometer readings. Insurance, loan payments and accessories aren't in it."
        value={formatCurrency(runningCostPerKm.value)}
        compared={comparison(runningCostPerKm, previous, "cost", (change) =>
          formatCurrency(change),
        )}
        otherwise={
          runningCostPerKm.value === null
            ? "Needs two odometer readings in the period"
            : `No km to compare with in ${formatDateRange(previous)}`
        }
      />
      <MetricCard
        label="Average mileage"
        icon={Fuel}
        href="/fuel"
        info="Km ÷ fuel over the full-tank to full-tank cycles that ended in the period. Partial fills roll into the next full tank."
        value={formatEfficiency(mileage.value, mileage.unit)}
        compared={comparison(mileage, previous, "efficiency", (change) =>
          formatEfficiency(change, mileage.unit),
        )}
        otherwise={
          mileage.cycles
            ? `From ${formatNumber(mileage.cycles)} full-tank ${mileage.cycles === 1 ? "cycle" : "cycles"}`
            : "Needs two full-tank fill-ups"
        }
      />
      <MetricCard
        label="Distance"
        icon={Route}
        href="/fuel"
        info="From odometer readings on fill-ups and expenses: the highest reading in the period minus the last one before it."
        value={formatDistance(distance.value)}
        compared={comparison(distance, previous, "neutral")}
        otherwise={
          distance.value === null
            ? "Needs two odometer readings in the period"
            : "From odometer readings"
        }
      />
      <MetricCard
        label="Fuel spend"
        icon={Milestone}
        href="/fuel"
        className="max-lg:col-span-2"
        info="Fill-ups in the period, refunds subtracted, and how much fuel they bought."
        value={formatCurrency(fuelSpend.value)}
        compared={comparison(fuelSpend, previous, "cost")}
        otherwise={formatVolume(fuelSpend.quantity, fuelSpend.unit)}
        extra={formatVolume(fuelSpend.quantity, fuelSpend.unit)}
      />
    </section>
  );
}

function MetricCard({
  label,
  icon: Icon,
  href,
  info,
  value,
  compared,
  otherwise,
  extra,
  className,
}: {
  label: string;
  icon: LucideIcon;
  /** The module behind the number: the whole card opens it. */
  href: string;
  /** How it's worked out. */
  info: string;
  value: string;
  compared: { text: string; tone: string } | null;
  /** What the line under the value says when there's nothing to compare. */
  otherwise: ReactNode;
  /** Shown after the comparison. */
  extra?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative h-full transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col justify-between gap-2">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            {/* The link covers the card (after:inset-0); the info button sits above it. */}
            <Link
              to={href}
              className="truncate outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              {label}
            </Link>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`How ${label.toLowerCase()} is worked out`}
                  className="relative z-10 -m-2 shrink-0 rounded-full p-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:-m-3 max-md:p-3"
                >
                  <Info className="size-3.5" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-sm">{info}</PopoverContent>
            </Popover>
          </span>
          <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        </div>
        <div className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        <div className="text-xs tabular-nums">
          {compared ? (
            <span className={compared.tone}>
              {compared.text}
              {extra && <span className="text-muted-foreground"> · {extra}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{otherwise}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
