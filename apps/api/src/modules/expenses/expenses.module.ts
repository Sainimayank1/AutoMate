import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { ExpenseBudgetsController } from "./expense-budgets.controller";
import { ExpenseBudgetsService } from "./expense-budgets.service";
import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpenseFiguresService } from "./expense-figures.service";
import { ExpenseImportService } from "./expense-import.service";
import { ExpenseInsightsService } from "./expense-insights.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { LinkedExpensesService } from "./linked-expenses.service";
import { OwnershipService } from "./ownership.service";
import { RecurringExpensesController } from "./recurring-expenses.controller";
import { RecurringExpensesService } from "./recurring-expenses.service";
import { VehicleLoansController } from "./vehicle-loans.controller";
import { VehicleLoansService } from "./vehicle-loans.service";

@Module({
  imports: [VehiclesModule],
  controllers: [
    ExpensesController,
    ExpenseCategoriesController,
    RecurringExpensesController,
    VehicleLoansController,
    ExpenseBudgetsController,
  ],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseFiguresService,
    LinkedExpensesService,
    RecurringExpensesService,
    VehicleLoansService,
    ExpenseBudgetsService,
    OwnershipService,
    ExpenseInsightsService,
    ExpenseImportService,
  ],
  // Fuel (and later Maintenance, Trips) keep their money here through LinkedExpensesService.
  exports: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseFiguresService,
    LinkedExpensesService,
    // The dashboard's action centre reads upcoming payments and EMIs.
    RecurringExpensesService,
    VehicleLoansService,
    // Backup restores budgets through it.
    ExpenseBudgetsService,
    // Analytics compares every vehicle's ownership cost.
    OwnershipService,
  ],
})
export class ExpensesModule {}
