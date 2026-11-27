import { Module } from "@nestjs/common";

import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { FuelController } from "./fuel.controller";
import { FuelService } from "./fuel.service";

@Module({
  imports: [VehiclesModule],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
