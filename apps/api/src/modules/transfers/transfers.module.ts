import { Module } from "@nestjs/common";

import { BackupModule } from "@/modules/backup/backup.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [BackupModule, VehiclesModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
