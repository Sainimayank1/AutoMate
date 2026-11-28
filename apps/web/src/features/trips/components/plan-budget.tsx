import { FUEL_UNIT, type FuelType, type TripPlan } from "@automate/shared";

import { COST_COLORS } from "@/features/trips/constants";
import { formatCurrency, formatNumber } from "@/utils/format";

// The same colours as actual trip costs, so planned and actual read alike.
const PARTS = [
  { key: "fuel", label: "Fuel", color: COST_COLORS.FUEL },
  { key: "estToll", label: "Toll", color: COST_COLORS.TOLL },
  { key: "estParking", label: "Parking", color: COST_COLORS.PARKING },
  { key: "estAccommodation", label: "Stay", color: COST_COLORS.ACCOMMODATION },
  { key: "estOther", label: "Other", color: COST_COLORS.OTHER },
] as const;

/** A plan's estimate: the total, a bar by part and the rows (unknown parts left out). */
export function PlanBudget({ plan, fuelType }: { plan: TripPlan; fuelType?: FuelType }) {
  const unit = fuelType ? FUEL_UNIT[fuelType] : "L";
  const total = Number(plan.budget.total ?? 0);
  const rows = PARTS.map((part) => ({
    ...part,
    amount: part.key === "fuel" ? plan.budget.fuelCost : plan[part.key],
  })).filter((row) => row.amount);

  if (!plan.budget.total) {
    return (
      <p className="text-sm text-muted-foreground">
        No estimate yet. Add the distance, mileage and fuel price, or the costs you expect.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-heading text-3xl font-semibold tabular-nums">
          {formatCurrency(plan.budget.total)}
        </p>
        {plan.budget.perKm && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatCurrency(plan.budget.perKm)} per km
          </p>
        )}
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {rows.map((row) => (
          <span
            key={row.key}
            className="h-full"
            style={{
              width: `${total > 0 ? (Number(row.amount) / total) * 100 : 0}%`,
              backgroundColor: row.color,
            }}
          />
        ))}
      </div>
      <dl className="flex flex-col gap-2.5 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              {row.label}
              {row.key === "fuel" && plan.budget.fuelQuantity && (
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber(Number(plan.budget.fuelQuantity))} {unit} at{" "}
                  {formatNumber(Number(plan.estMileage))} km/{unit}
                </span>
              )}
            </dt>
            <dd className="font-medium tabular-nums">{formatCurrency(row.amount!)}</dd>
          </div>
        ))}
      </dl>
      {!plan.budget.fuelCost && (
        <p className="text-xs text-muted-foreground">
          Fuel isn&apos;t estimated: it needs the distance, mileage and fuel price.
        </p>
      )}
    </div>
  );
}
