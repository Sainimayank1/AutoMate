import { createFuelEntrySchema, updateFuelEntrySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateFuelEntryDto extends createZodDto(createFuelEntrySchema) {}
export class UpdateFuelEntryDto extends createZodDto(updateFuelEntrySchema) {}
