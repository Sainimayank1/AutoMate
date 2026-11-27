import type { DashboardOverview } from "@automate/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { DASHBOARD_OVERVIEW_SCHEMA } from "./dashboard.constants";
import { DashboardService } from "./dashboard.service";
import { DashboardOverviewQueryDto } from "./dto/dashboard.dto";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

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
}
