import type { VehicleComponent, VehicleComponentDetail } from "@automate/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { ComponentsService } from "./components.service";
import {
  ComponentListQueryDto,
  CreateComponentDto,
  InspectComponentDto,
  RemoveComponentDto,
  ReplaceComponentDto,
  UpdateComponentDto,
} from "./dto/maintenance.dto";
import { COMPONENT_SCHEMA } from "./maintenance.constants";

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller("vehicles/:vehicleId/components")
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get()
  @ApiOperation({ summary: "A vehicle's tracked parts: fitted (most in need first) or taken off" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: ComponentListQueryDto,
  ): Promise<Paginated<VehicleComponent>> {
    return this.components.list(user.id, vehicleId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One part with its estimated life and lifecycle history" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VehicleComponentDetail> {
    return this.components.get(user.id, vehicleId, id);
  }

  @Post()
  @ApiOperation({ summary: "Start tracking a part" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: CreateComponentDto,
  ): Promise<VehicleComponentDetail> {
    return this.components.create(user.id, vehicleId, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change a part's details (not its condition or state)" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateComponentDto,
  ): Promise<VehicleComponentDetail> {
    return this.components.update(user.id, vehicleId, id, body);
  }

  @Post(":id/inspect")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record the user's own check and the part's condition" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  inspect(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: InspectComponentDto,
  ): Promise<VehicleComponentDetail> {
    return this.components.inspect(user.id, vehicleId, id, body);
  }

  @Post(":id/replace")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Replace a part (keeps the old one; logs a replacement record; returns the new part)",
  })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  replace(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReplaceComponentDto,
  ): Promise<VehicleComponentDetail> {
    return this.components.replace(user.id, vehicleId, id, body);
  }

  @Post(":id/remove")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a part removed (no successor; history kept)" })
  @ApiEnvelopeResponse(COMPONENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  retire(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RemoveComponentDto,
  ): Promise<VehicleComponentDetail> {
    return this.components.retire(user.id, vehicleId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a part and its lifecycle (records and schedules are kept)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.components.remove(user.id, vehicleId, id);
  }
}
