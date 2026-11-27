import {
  dashboardActivityQuerySchema,
  dashboardLayoutSchema,
  dashboardOverviewQuerySchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class DashboardOverviewQueryDto extends createZodDto(dashboardOverviewQuerySchema) {}
export class DashboardActivityQueryDto extends createZodDto(dashboardActivityQuerySchema) {}
export class DashboardLayoutDto extends createZodDto(dashboardLayoutSchema) {}
