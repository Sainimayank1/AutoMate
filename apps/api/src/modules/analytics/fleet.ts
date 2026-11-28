import type { AnalyticsOverview, MileageFigure, OwnershipCost } from "@automate/shared";

import { Prisma } from "@/generated/prisma/client";
import { monthsBetween } from "@/modules/expenses/depreciation";

type Decimal = Prisma.Decimal;
const D = (value: string) => new Prisma.Decimal(value);
const money = (value: Decimal) => value.toFixed(2);
const sum = (values: Decimal[]) => values.reduce((all, value) => all.plus(value), D("0"));

/**
 * The fleet's totals from each vehicle's ownership figures (decimals throughout). Depreciation,
 * resale value and km add up only over the vehicles that have them; cost per km divides the
 * economic cost of the vehicles with km by their km, so a vehicle without readings doesn't
 * deflate it. Mileage is a cycles-weighted average, only across one unit (km/L with km/L).
 */
export function fleetTotals(
  vehicles: { ownership: OwnershipCost; mileage: MileageFigure | null }[],
  window: { from: string; to: string },
): AnalyticsOverview["totals"] {
  const costs = vehicles.map((vehicle) => vehicle.ownership);
  const economic = sum(costs.map((cost) => D(cost.economic)));
  const priced = costs.filter((cost) => cost.depreciation);
  const depreciation = priced.length
    ? sum(priced.map((cost) => D(cost.depreciation!.amount)))
    : null;
  const measured = costs.filter((cost) => cost.distanceKm);
  const distanceKm = measured.length
    ? measured.reduce((all, cost) => all + cost.distanceKm!, 0)
    : null;
  const months = D(String(Math.max(monthsBetween(window.from, window.to), 1))).toDecimalPlaces(1);
  const withMileage = vehicles.flatMap((vehicle) => (vehicle.mileage ? [vehicle.mileage] : []));
  const units = new Set(withMileage.map((figure) => figure.unit));
  const cycles = withMileage.reduce((all, figure) => all + figure.cycles, 0);
  return {
    spent: money(economic.minus(depreciation ?? 0)),
    economic: money(economic),
    cashOutflow: money(sum(costs.map((cost) => D(cost.cashOutflow)))),
    principal: money(sum(costs.map((cost) => D(cost.principal)))),
    depreciation: depreciation && money(depreciation),
    estimatedValue: priced.length
      ? money(sum(priced.map((cost) => D(cost.depreciation!.estimatedValue))))
      : null,
    distanceKm,
    costPerKm: distanceKm
      ? money(sum(measured.map((cost) => D(cost.economic))).div(distanceKm))
      : null,
    perMonth: money(economic.div(months)),
    mileage:
      withMileage.length && units.size === 1 && cycles > 0
        ? {
            value: sum(withMileage.map((figure) => D(figure.value).times(figure.cycles)))
              .div(cycles)
              .toFixed(2),
            unit: withMileage[0]!.unit,
            cycles,
          }
        : null,
  };
}
