import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [VehiclesModule],
  controllers: [TripsController],
  providers: [TripsService],
  // The dashboard reads trip figures from here (dashboard.md §6).
  exports: [TripsService],
})
export class TripsModule {}
