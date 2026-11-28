import { analyticsQuerySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class AnalyticsQueryDto extends createZodDto(analyticsQuerySchema) {}
