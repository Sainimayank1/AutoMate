import type { Inspection } from "@automate/shared";
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

import {
  CreateInspectionDto,
  InspectionListQueryDto,
  UpdateInspectionDto,
} from "./dto/maintenance.dto";
import { InspectionsService } from "./inspections.service";
import { INSPECTION_SCHEMA } from "./maintenance.constants";

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller("vehicles/:vehicleId/inspections")
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Get()
  @ApiOperation({ summary: "A vehicle's inspections, newest first, a page at a time" })
  @ApiEnvelopeResponse(INSPECTION_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: InspectionListQueryDto,
  ): Promise<Paginated<Inspection>> {
    return this.inspections.list(user.id, vehicleId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One inspection with its checklist and follow-ups" })
  @ApiEnvelopeResponse(INSPECTION_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Inspection> {
    return this.inspections.get(user.id, vehicleId, id);
  }

  @Post()
  @ApiOperation({ summary: "Record an inspection (the user's own check, or a workshop's)" })
  @ApiEnvelopeResponse(INSPECTION_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: CreateInspectionDto,
  ): Promise<Inspection> {
    return this.inspections.create(user.id, vehicleId, body);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Change an inspection (items replace the checklist, keeping their ids)",
  })
  @ApiEnvelopeResponse(INSPECTION_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateInspectionDto,
  ): Promise<Inspection> {
    return this.inspections.update(user.id, vehicleId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an inspection (schedules created from it are kept)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.inspections.remove(user.id, vehicleId, id);
  }
}
