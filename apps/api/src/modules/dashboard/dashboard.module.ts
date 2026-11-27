import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardLayoutService } from "./dashboard-layout.service";

@Module({
  imports: [VehiclesModule, ExpensesModule, FuelModule, MaintenanceModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardLayoutService],
})
export class DashboardModule {}
