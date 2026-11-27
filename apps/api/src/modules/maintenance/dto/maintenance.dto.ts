import {
  createScheduleSchema,
  createServiceRecordSchema,
  maintenanceOverviewQuerySchema,
  providerListQuerySchema,
  scheduleListQuerySchema,
  serviceRecordFiltersSchema,
  serviceRecordListQuerySchema,
  updateScheduleSchema,
  updateServiceRecordSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateScheduleDto extends createZodDto(createScheduleSchema) {}
export class UpdateScheduleDto extends createZodDto(updateScheduleSchema) {}
export class ScheduleListQueryDto extends createZodDto(scheduleListQuerySchema) {}
export class MaintenanceOverviewQueryDto extends createZodDto(maintenanceOverviewQuerySchema) {}

export class CreateServiceRecordDto extends createZodDto(createServiceRecordSchema) {}
export class UpdateServiceRecordDto extends createZodDto(updateServiceRecordSchema) {}
export class ServiceRecordListQueryDto extends createZodDto(serviceRecordListQuerySchema) {}
export class ServiceRecordFiltersDto extends createZodDto(serviceRecordFiltersSchema) {}
export class ProviderListQueryDto extends createZodDto(providerListQuerySchema) {}
