import { createVehicleSchema, updateVehicleSchema, vehicleListQuerySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateVehicleDto extends createZodDto(createVehicleSchema) {}
export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
export class VehicleListQueryDto extends createZodDto(vehicleListQuerySchema) {}
