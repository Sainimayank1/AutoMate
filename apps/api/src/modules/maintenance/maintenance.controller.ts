import type { MaintenanceOverview, MaintenanceSchedule } from "@automate/shared";
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
  CreateScheduleDto,
  MaintenanceOverviewQueryDto,
  ScheduleListQueryDto,
  UpdateScheduleDto,
} from "./dto/maintenance.dto";
import { OVERVIEW_SCHEMA, SCHEDULE_SCHEMA } from "./maintenance.constants";
import { MaintenanceService } from "./maintenance.service";

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller("vehicles/:vehicleId")
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get("maintenance-overview")
  @ApiOperation({ summary: "Maintenance state, due items and spending for a vehicle" })
  @ApiEnvelopeResponse(OVERVIEW_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  overview(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: MaintenanceOverviewQueryDto,
  ): Promise<MaintenanceOverview> {
    return this.maintenance.overview(user.id, vehicleId, query);
  }

  @Get("maintenance-schedules")
  @ApiOperation({
    summary: "A vehicle's maintenance schedules, most urgent first, a page at a time",
  })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: ScheduleListQueryDto,
  ): Promise<Paginated<MaintenanceSchedule>> {
    return this.maintenance.list(user.id, vehicleId, query);
  }

  @Get("maintenance-schedules/:id")
  @ApiOperation({ summary: "One schedule with its due figures" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.get(user.id, vehicleId, id);
  }

  @Post("maintenance-schedules")
  @ApiOperation({ summary: "Add a schedule (repeating by km and/or months, or one-time)" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: CreateScheduleDto,
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.create(user.id, vehicleId, body);
  }

  @Patch("maintenance-schedules/:id")
  @ApiOperation({ summary: "Change a schedule (null clears a field)" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateScheduleDto,
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.update(user.id, vehicleId, id, body);
  }

  @Post("maintenance-schedules/:id/pause")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pause a schedule (kept, not counted as due)" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  pause(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.setPaused(user.id, vehicleId, id, true);
  }

  @Post("maintenance-schedules/:id/resume")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resume a paused schedule" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  resume(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MaintenanceSchedule> {
    return this.maintenance.setPaused(user.id, vehicleId, id, false);
  }

  @Delete("maintenance-schedules/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a schedule" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.maintenance.remove(user.id, vehicleId, id);
  }
}
