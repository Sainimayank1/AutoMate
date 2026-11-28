import type {
  MaintenanceAnalytics,
  MaintenanceOverview,
  MaintenancePlanSummary,
  MaintenanceSchedule,
} from "@automate/shared";
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
  BulkCreateSchedulesDto,
  CreateScheduleDto,
  MaintenanceAnalyticsQueryDto,
  MaintenanceOverviewQueryDto,
  ScheduleListQueryDto,
  UpdateScheduleDto,
} from "./dto/maintenance.dto";
import {
  ANALYTICS_SCHEMA,
  OVERVIEW_SCHEMA,
  PLAN_SCHEMA,
  SCHEDULE_SCHEMA,
} from "./maintenance.constants";
import { MaintenanceService } from "./maintenance.service";
import { MaintenanceAnalyticsService } from "./maintenance-analytics.service";

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller("vehicles/:vehicleId")
export class MaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly analyticsService: MaintenanceAnalyticsService,
  ) {}

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

  @Get("maintenance-analytics")
  @ApiOperation({
    summary: "Spending, visits, frequency, replacements and rule-based insights for a period",
  })
  @ApiEnvelopeResponse(ANALYTICS_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  analytics(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: MaintenanceAnalyticsQueryDto,
  ): Promise<MaintenanceAnalytics> {
    return this.analyticsService.analytics(user.id, vehicleId, query);
  }

  @Get("maintenance-plan")
  @ApiOperation({ summary: "Open one-time jobs and the total of their estimates (not spend)" })
  @ApiEnvelopeResponse(PLAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  plan(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
  ): Promise<MaintenancePlanSummary> {
    return this.maintenance.plan(user.id, vehicleId);
  }

  @Post("maintenance-schedules/bulk")
  @ApiOperation({ summary: "Add several schedules at once (a reviewed template), all or none" })
  @ApiEnvelopeResponse(SCHEDULE_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  createMany(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: BulkCreateSchedulesDto,
  ): Promise<MaintenanceSchedule[]> {
    return this.maintenance.createMany(user.id, vehicleId, body);
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
