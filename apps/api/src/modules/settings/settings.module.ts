import { Module } from "@nestjs/common";

import { AuthModule } from "@/modules/auth/auth.module";
import { UsersModule } from "@/modules/users/users.module";
import { VehiclesModule } from "@/modules/vehicles/vehicles.module";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AuthModule, UsersModule, VehiclesModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  // Notifications reads the reminder switches.
  exports: [SettingsService],
})
export class SettingsModule {}
