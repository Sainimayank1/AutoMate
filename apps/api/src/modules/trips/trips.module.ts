import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { TripCostsController } from "./trip-costs.controller";
import { TripCostsService } from "./trip-costs.service";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [VehiclesModule, ExpensesModule, FuelModule],
  controllers: [TripsController, TripCostsController],
  providers: [TripsService, TripCostsService],
  // The dashboard reads trip figures from here (dashboard.md §6).
  exports: [TripsService],
})
export class TripsModule {}
