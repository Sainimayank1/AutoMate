import {
  completeTripPlanSchema,
  createTripCostSchema,
  createTripPlanSchema,
  createTripSchema,
  createTripUploadSchema,
  linkFuelEntrySchema,
  paginationQuerySchema,
  routeCalculateSchema,
  tripAnalyticsQuerySchema,
  tripBulkSchema,
  tripCategoryFieldsSchema,
  tripCostListQuerySchema,
  tripCostSummaryQuerySchema,
  tripFiltersSchema,
  tripImportSchema,
  tripListQuerySchema,
  tripOverviewQuerySchema,
  tripPlanListQuerySchema,
  updateTripCostSchema,
  updateTripPlanSchema,
  updateTripSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTripDto extends createZodDto(createTripSchema) {}
export class UpdateTripDto extends createZodDto(updateTripSchema) {}
export class TripListQueryDto extends createZodDto(tripListQuerySchema) {}
export class TripOverviewQueryDto extends createZodDto(tripOverviewQuerySchema) {}
export class TripCategoryDto extends createZodDto(tripCategoryFieldsSchema) {}
export class TripCategoryListQueryDto extends createZodDto(paginationQuerySchema) {}
export class TripFiltersDto extends createZodDto(tripFiltersSchema) {}
export class TripBulkDto extends createZodDto(tripBulkSchema) {}
export class CreateTripCostDto extends createZodDto(createTripCostSchema) {}
export class UpdateTripCostDto extends createZodDto(updateTripCostSchema) {}
export class LinkFuelEntryDto extends createZodDto(linkFuelEntrySchema) {}
export class TripCostListQueryDto extends createZodDto(tripCostListQuerySchema) {}
export class TripCostSummaryQueryDto extends createZodDto(tripCostSummaryQuerySchema) {}
export class RouteCalculateDto extends createZodDto(routeCalculateSchema) {}
export class CreateTripPlanDto extends createZodDto(createTripPlanSchema) {}
export class UpdateTripPlanDto extends createZodDto(updateTripPlanSchema) {}
export class TripPlanListQueryDto extends createZodDto(tripPlanListQuerySchema) {}
export class CompleteTripPlanDto extends createZodDto(completeTripPlanSchema) {}
export class TripAnalyticsQueryDto extends createZodDto(tripAnalyticsQuerySchema) {}
export class TripImportDto extends createZodDto(tripImportSchema) {}
export class CreateTripUploadDto extends createZodDto(createTripUploadSchema) {}
