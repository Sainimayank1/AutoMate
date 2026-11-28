import { Module } from "@nestjs/common";

import { DocumentsModule } from "@/modules/documents/documents.module";
import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { TripsModule } from "@/modules/trips/trips.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";

@Module({
  imports: [
    VehiclesModule,
    FuelModule,
    MaintenanceModule,
    ExpensesModule,
    TripsModule,
    DocumentsModule,
  ],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
