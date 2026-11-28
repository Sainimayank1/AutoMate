import {
  dashboardActivityQuerySchema,
  dashboardLayoutSchema,
  dashboardOverviewQuerySchema,
  dismissDashboardItemSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class DashboardOverviewQueryDto extends createZodDto(dashboardOverviewQuerySchema) {}
export class DashboardActivityQueryDto extends createZodDto(dashboardActivityQuerySchema) {}
export class DashboardLayoutDto extends createZodDto(dashboardLayoutSchema) {}
export class DismissDashboardItemDto extends createZodDto(dismissDashboardItemSchema) {}
