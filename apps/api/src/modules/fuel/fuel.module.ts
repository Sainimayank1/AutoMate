import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { FuelController } from "./fuel.controller";
import { FuelService } from "./fuel.service";

@Module({
  imports: [VehiclesModule, ExpensesModule],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
