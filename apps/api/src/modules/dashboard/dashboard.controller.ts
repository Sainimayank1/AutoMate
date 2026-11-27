import type { ActivityItem, DashboardLayout, DashboardOverview } from "@automate/shared";
import { Body, Controller, Get, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import {
  ACTIVITY_ITEM_SCHEMA,
  DASHBOARD_LAYOUT_SCHEMA,
  DASHBOARD_OVERVIEW_SCHEMA,
} from "./dashboard.constants";
import { DashboardService } from "./dashboard.service";
import { DashboardLayoutService } from "./dashboard-layout.service";
import {
  DashboardActivityQueryDto,
  DashboardLayoutDto,
  DashboardOverviewQueryDto,
} from "./dto/dashboard.dto";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly layouts: DashboardLayoutService,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "The dashboard for one vehicle and period (IST calendar)" })
  @ApiEnvelopeResponse(DASHBOARD_OVERVIEW_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  overview(
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardOverviewQueryDto,
  ): Promise<DashboardOverview> {
    return this.dashboard.overview(user.id, query);
  }

  @Get("activity")
  @ApiOperation({
    summary: "What happened to the vehicle, newest first (fill-ups, expenses, services)",
  })
  @ApiEnvelopeResponse(ACTIVITY_ITEM_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  activity(
    @CurrentUser() user: AuthUser,
    @Query() query: DashboardActivityQueryDto,
  ): Promise<Paginated<ActivityItem>> {
    return this.dashboard.activity(user.id, query);
  }

  @Get("layout")
  @ApiOperation({ summary: "The signed-in user's dashboard layout (the default until saved)" })
  @ApiEnvelopeResponse(DASHBOARD_LAYOUT_SCHEMA)
  @ApiErrorResponses(401)
  layout(@CurrentUser() user: AuthUser): Promise<DashboardLayout> {
    return this.layouts.get(user.id);
  }

  @Put("layout")
  @ApiOperation({
    summary: "Save the dashboard layout: every section once, shown or hidden, and the key figures",
  })
  @ApiEnvelopeResponse(DASHBOARD_LAYOUT_SCHEMA)
  @ApiErrorResponses(400, 401)
  saveLayout(
    @CurrentUser() user: AuthUser,
    @Body() body: DashboardLayoutDto,
  ): Promise<DashboardLayout> {
    return this.layouts.save(user.id, body);
  }
}
