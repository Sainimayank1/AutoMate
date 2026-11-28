import { searchQuerySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
