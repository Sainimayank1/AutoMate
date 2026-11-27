import {
  componentListQuerySchema,
  createComponentSchema,
  createInspectionSchema,
  createProviderSchema,
  createScheduleSchema,
  createServiceRecordSchema,
  inspectComponentSchema,
  inspectionListQuerySchema,
  maintenanceOverviewQuerySchema,
  paginationQuerySchema,
  providerListQuerySchema,
  removeComponentSchema,
  replaceComponentSchema,
  scheduleListQuerySchema,
  serviceRecordFiltersSchema,
  serviceRecordListQuerySchema,
  updateComponentSchema,
  updateInspectionSchema,
  updateProviderSchema,
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

export class CreateComponentDto extends createZodDto(createComponentSchema) {}
export class UpdateComponentDto extends createZodDto(updateComponentSchema) {}
export class ComponentListQueryDto extends createZodDto(componentListQuerySchema) {}
export class InspectComponentDto extends createZodDto(inspectComponentSchema) {}
export class RemoveComponentDto extends createZodDto(removeComponentSchema) {}
export class ReplaceComponentDto extends createZodDto(replaceComponentSchema) {}

export class CreateInspectionDto extends createZodDto(createInspectionSchema) {}
export class UpdateInspectionDto extends createZodDto(updateInspectionSchema) {}
export class InspectionListQueryDto extends createZodDto(inspectionListQuerySchema) {}

export class CreateProviderDto extends createZodDto(createProviderSchema) {}
export class UpdateProviderDto extends createZodDto(updateProviderSchema) {}
export class ProviderListQueryDto extends createZodDto(providerListQuerySchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
