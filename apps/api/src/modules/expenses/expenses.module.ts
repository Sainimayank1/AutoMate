import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { LinkedExpensesService } from "./linked-expenses.service";

@Module({
  imports: [VehiclesModule],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService, ExpenseCategoriesService, LinkedExpensesService],
  // Fuel (and later Maintenance, Trips) keep their money here through LinkedExpensesService.
  exports: [ExpensesService, ExpenseCategoriesService, LinkedExpensesService],
})
export class ExpensesModule {}
