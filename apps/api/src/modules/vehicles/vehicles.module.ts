import { Module } from "@nestjs/common";

import { OdometerHistoryService } from "./odometer-history.service";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, OdometerHistoryService],
  exports: [VehiclesService, OdometerHistoryService],
})
export class VehiclesModule {}
