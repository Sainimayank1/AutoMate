import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { ComponentsController } from "./components.controller";
import { ComponentsService } from "./components.service";
import { InspectionsController } from "./inspections.controller";
import { InspectionsService } from "./inspections.service";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceAnalyticsService } from "./maintenance-analytics.service";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { ServiceRecordsController } from "./service-records.controller";
import { ServiceRecordsService } from "./service-records.service";

@Module({
  imports: [VehiclesModule, ExpensesModule],
  controllers: [
    MaintenanceController,
    ServiceRecordsController,
    ComponentsController,
    InspectionsController,
    ProvidersController,
  ],
  providers: [
    MaintenanceAnalyticsService,
    MaintenanceService,
    ServiceRecordsService,
    ComponentsService,
    InspectionsService,
    ProvidersService,
  ],
  // The dashboard reads maintenance figures and service records from here (dashboard.md §6).
  exports: [MaintenanceService, ServiceRecordsService, ComponentsService, InspectionsService],
})
export class MaintenanceModule {}
