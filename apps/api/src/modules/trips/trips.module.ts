import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { GeocodingModule } from "@/modules/geocoding/geocoding.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { TripAnalyticsService } from "./trip-analytics.service";
import { TripBackupService } from "./trip-backup.service";
import { TripCostsController } from "./trip-costs.controller";
import { TripCostsService } from "./trip-costs.service";
import { TripImportService } from "./trip-import.service";
import { TripPlansController } from "./trip-plans.controller";
import { TripPlansService } from "./trip-plans.service";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [VehiclesModule, ExpensesModule, FuelModule, GeocodingModule],
  controllers: [TripsController, TripCostsController, TripPlansController],
  providers: [
    TripsService,
    TripCostsService,
    TripPlansService,
    TripAnalyticsService,
    TripImportService,
    TripBackupService,
  ],
  // The dashboard reads trip figures (dashboard.md §6); Notifications the reminders; Backup the rows.
  exports: [TripsService, TripPlansService, TripBackupService],
})
export class TripsModule {}
