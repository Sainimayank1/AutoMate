import { Module } from "@nestjs/common";

import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [VehiclesModule, ExpensesModule, FuelModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
