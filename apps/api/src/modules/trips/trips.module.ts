import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { GeocodingModule } from "@/modules/geocoding/geocoding.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { TripCostsController } from "./trip-costs.controller";
import { TripCostsService } from "./trip-costs.service";
import { TripPlansController } from "./trip-plans.controller";
import { TripPlansService } from "./trip-plans.service";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [VehiclesModule, ExpensesModule, FuelModule, GeocodingModule],
  controllers: [TripsController, TripCostsController, TripPlansController],
  providers: [TripsService, TripCostsService, TripPlansService],
  // The dashboard reads trip figures from here (dashboard.md §6).
  exports: [TripsService],
})
export class TripsModule {}
