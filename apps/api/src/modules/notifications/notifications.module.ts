import { Module } from "@nestjs/common";

import { DocumentsModule } from "@/modules/documents/documents.module";
import { ExpensesModule } from "@/modules/expenses/expenses.module";
import { FuelModule } from "@/modules/fuel/fuel.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { SettingsModule } from "@/modules/settings/settings.module";
import { TripsModule } from "@/modules/trips/trips.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [
    VehiclesModule,
    SettingsModule,
    DocumentsModule,
    MaintenanceModule,
    ExpensesModule,
    TripsModule,
    FuelModule,
  ],
  controllers: [NotificationsController, RemindersController],
  providers: [NotificationsService, RemindersService],
  // The dashboard's action centre shows due reminders.
  exports: [RemindersService],
})
export class NotificationsModule {}
