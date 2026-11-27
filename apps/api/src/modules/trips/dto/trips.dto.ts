import {
  createTripSchema,
  paginationQuerySchema,
  tripCategoryFieldsSchema,
  tripListQuerySchema,
  tripOverviewQuerySchema,
  updateTripSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTripDto extends createZodDto(createTripSchema) {}
export class UpdateTripDto extends createZodDto(updateTripSchema) {}
export class TripListQueryDto extends createZodDto(tripListQuerySchema) {}
export class TripOverviewQueryDto extends createZodDto(tripOverviewQuerySchema) {}
export class TripCategoryDto extends createZodDto(tripCategoryFieldsSchema) {}
export class TripCategoryListQueryDto extends createZodDto(paginationQuerySchema) {}
