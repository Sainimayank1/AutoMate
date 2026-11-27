import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpensesLayout } from "@/features/expenses/components/expenses-layout";
import { LoansSection, SchedulesSection } from "@/features/expenses/components/loans-and-schedules";
import { PaymentsCard } from "@/features/expenses/components/payments-card";
import { ALL_VEHICLES, useExpenseFilters } from "@/features/expenses/hooks/use-expense-filters";
import { vehicleName } from "@/features/garage/constants";
import { useVehicles } from "@/features/garage/hooks/use-vehicles";

/**
 * `/expenses/recurring` (Stitch "Expenses — Recurring"): upcoming payments, loans and schedules
 * for the vehicle in scope. `?pay=<schedule>&due=<date>` (the dashboard's "Record payment") opens
 * that payment's record dialog.
 */
export function Component() {
  const filters = useExpenseFilters();
  const vehicles = useVehicles();
  const [params] = useSearchParams();
  const vehicleId = filters.query.vehicleId;
  const pay = params.get("pay");
  const due = params.get("due");

  return (
    <ExpensesLayout tab="recurring">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filters.vehicle} onValueChange={(value) => filters.set("vehicle", value)}>
          <SelectTrigger aria-label="Vehicle scope" className="w-full sm:w-64 max-md:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
            {(vehicles.data ?? []).map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicleName(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
          <Button variant="outline" asChild className="max-md:h-10">
            <Link to="/expenses/loans/new">
              <Plus data-icon="inline-start" />
              Add loan
            </Link>
          </Button>
          <Button variant="outline" asChild className="max-md:h-10">
            <Link to="/expenses/recurring/new">
              <Plus data-icon="inline-start" />
              Add recurring payment
            </Link>
          </Button>
        </div>
      </div>
      <PaymentsCard
        key={vehicleId ?? ALL_VEHICLES}
        vehicleId={vehicleId}
        initialPay={pay && due ? { recurringId: pay, dueDate: due } : undefined}
      />
      <LoansSection vehicleId={vehicleId} />
      <SchedulesSection vehicleId={vehicleId} />
    </ExpensesLayout>
  );
}
