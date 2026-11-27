import { dashboardOverviewQuerySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class DashboardOverviewQueryDto extends createZodDto(dashboardOverviewQuerySchema) {}
