import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceService } from "./maintenance.service";
import { ServiceRecordsController } from "./service-records.controller";
import { ServiceRecordsService } from "./service-records.service";

@Module({
  imports: [VehiclesModule, ExpensesModule],
  controllers: [MaintenanceController, ServiceRecordsController],
  providers: [MaintenanceService, ServiceRecordsService],
  // The dashboard reads maintenance figures from here (docs/architecture/dashboard.md §6).
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
