# Analytics & total cost of ownership (M8): design

What every vehicle really costs, side by side, and the fleet's totals. Product scope: [MODULES.md M8](../MODULES.md#module-8--analytics--cost-of-ownership). It adds no money rules of its own: every figure is a vehicle's ownership cost from Expenses ([expenses.md §8](expenses.md#8-ownership-cost)), mileage from the Fuel engine, and sums of those.

## 1. Rules

- **Scope:** the user's active vehicles (archived ones are left out of the totals and the chart alike); the period is this month, this year or since purchase (the ownership periods). "Since purchase" runs from the earliest vehicle's start.
- **Totals** (`fleet.ts`, tested in `fleet.spec.ts`): spent (economic cost without depreciation), economic cost, cash outflow and principal add up over every vehicle. Depreciation and the estimated resale value add up over the vehicles with a purchase price (null when none has one). Km add up over the vehicles with two readings in the period, and **true cost per km** divides the economic cost of those vehicles by their km, so a vehicle without readings doesn't make it look cheaper. The monthly average divides by the calendar months of the period (at least one).
- **Mileage** is averaged weighted by full-tank cycles, and only when every vehicle with one uses the same unit (km/L with km/L, never with km/kWh).
- **Spending** reuses the dashboard's section: each vehicle's spending by category is merged per category (and month), so the chart and the totals agree.
- **Trips:** trip charts and insights belong to Trips; Analytics shows usage only through the ownership figures and links there.

## 2. API

| Endpoint                  | Notes                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /analytics/overview` | `period` (`this_month`, `this_year` default, `all_time`): the window, the totals, the fleet's spending, and every vehicle's row (ownership cost, mileage, service spend). |

One vehicle's ownership cost and the printable report stay in Expenses (`/expenses/ownership`, `/expenses/report`); the comparison table and "Export report" link to them. Tested in `test/analytics.e2e-spec.ts` and `analytics.test.tsx`.

## 3. Not built yet

Per-module analytics tabs (fuel price trends, city/highway, maintenance), a vehicle picker for 2–3-way comparisons, and fleet-wide PDF/CSV reports: the Expenses report and CSV export cover one vehicle today.
