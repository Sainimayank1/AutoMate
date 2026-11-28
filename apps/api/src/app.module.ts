import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";

import { DEFAULT_RATE_LIMIT } from "./common/constants/http.constants";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { type Env, validateEnv } from "./config/env.validation";
import { loggerConfig } from "./config/logger.config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { BackupModule } from "./modules/backup/backup.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { FuelModule } from "./modules/fuel/fuel.module";
import { GeocodingModule } from "./modules/geocoding/geocoding.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SearchModule } from "./modules/search/search.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { TripsModule } from "./modules/trips/trips.module";
import { UsersModule } from "./modules/users/users.module";
import { VehiclesModule } from "./modules/vehicles/vehicles.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        loggerConfig({
          NODE_ENV: config.get("NODE_ENV", { infer: true }),
          LOG_LEVEL: config.get("LOG_LEVEL", { infer: true }),
        }),
    }),
    // shortcut: in-memory rate-limit counters are per instance; move to Redis storage when running >1 instance.
    ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    FuelModule,
    ExpensesModule,
    MaintenanceModule,
    TripsModule,
    DocumentsModule,
    AnalyticsModule,
    BackupModule,
    TransfersModule,
    NotificationsModule,
    AttachmentsModule,
    SearchModule,
    SettingsModule,
    StorageModule,
    DashboardModule,
    GeocodingModule,
    HealthModule,
    // Product modules (vehicles, fuel, expenses, ...) are added here as they are built.
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: rate-limit first, so unauthenticated floods are rejected cheaply.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
