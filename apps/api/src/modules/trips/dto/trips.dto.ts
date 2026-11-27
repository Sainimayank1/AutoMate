import {
  createTripCostSchema,
  createTripSchema,
  linkFuelEntrySchema,
  paginationQuerySchema,
  tripBulkSchema,
  tripCategoryFieldsSchema,
  tripCostListQuerySchema,
  tripCostSummaryQuerySchema,
  tripFiltersSchema,
  tripListQuerySchema,
  tripOverviewQuerySchema,
  updateTripCostSchema,
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
