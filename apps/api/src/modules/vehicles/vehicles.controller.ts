import type { Vehicle } from "@automate/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { CreateVehicleDto, UpdateVehicleDto } from "./dto/vehicle.dto";
import { VEHICLE_LIST_SCHEMA, VEHICLE_SCHEMA } from "./vehicles.constants";
import { VehiclesService } from "./vehicles.service";

@ApiTags("vehicles")
@ApiBearerAuth()
@Controller("vehicles")
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: "The signed-in user's vehicles (in use, or archived)" })
  @ApiQuery({ name: "archived", required: false, type: Boolean })
  @ApiEnvelopeResponse(VEHICLE_LIST_SCHEMA)
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query("archived", new ParseBoolPipe({ optional: true })) archived = false,
  ): Promise<Vehicle[]> {
    return this.vehicles.list(user.id, { archived });
  }

  @Get(":id")
  @ApiOperation({ summary: "One vehicle" })
  @ApiEnvelopeResponse(VEHICLE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Vehicle> {
    return this.vehicles.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Add a vehicle to the garage" })
  @ApiEnvelopeResponse(VEHICLE_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateVehicleDto): Promise<Vehicle> {
    return this.vehicles.create(user.id, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a vehicle (send only the fields that change; null clears one)" })
  @ApiEnvelopeResponse(VEHICLE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehicles.update(user.id, id, body);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive: hide from the switcher and lists, keep every record" })
  @ApiEnvelopeResponse(VEHICLE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  archive(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Vehicle> {
    return this.vehicles.archive(user.id, id);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bring an archived vehicle back" })
  @ApiEnvelopeResponse(VEHICLE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  restore(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Vehicle> {
    return this.vehicles.restore(user.id, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete permanently, with everything recorded for it" })
  @ApiErrorResponses(400, 401, 404)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.vehicles.remove(user.id, id);
  }
}
