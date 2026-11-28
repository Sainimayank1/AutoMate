import type { AnalyticsOverview } from "@automate/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { ANALYTICS_OVERVIEW_SCHEMA } from "./analytics.constants";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics.dto";

/** Analytics & total cost of ownership across the user's vehicles. */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Every vehicle's ownership cost side by side, and the fleet's totals" })
  @ApiEnvelopeResponse(ANALYTICS_OVERVIEW_SCHEMA)
  @ApiErrorResponses(400, 401)
  overview(
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverview> {
    return this.analytics.overview(user.id, query);
  }
}
