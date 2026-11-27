import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import { Public } from "@/modules/auth/decorators/public.decorator";

import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: "Liveness and dependency check (database, plus Redis when enabled)" })
  @ApiEnvelopeResponse(
    {
      type: "object",
      example: {
        status: "ok",
        checks: { database: "up" },
        app: {
          name: "automate-api",
          environment: "development",
          apiVersion: "v1",
          uptimeSeconds: 42,
        },
      },
    },
    { description: "All required dependencies are reachable" },
  )
  @ApiErrorResponses(503)
  check() {
    return this.health.check();
  }
}
