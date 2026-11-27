import { createVehicleSchema, updateVehicleSchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateVehicleDto extends createZodDto(createVehicleSchema) {}
export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
