import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpenseFiguresService } from "./expense-figures.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { LinkedExpensesService } from "./linked-expenses.service";
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
  ],
  providers: [
    ExpensesService,
    ExpenseCategoriesService,
    ExpenseFiguresService,
    LinkedExpensesService,
    RecurringExpensesService,
    VehicleLoansService,
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
  ],
})
export class ExpensesModule {}
