import type { Trip, TripPlan } from "@automate/shared";
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
  CompleteTripPlanDto,
  CreateTripPlanDto,
  TripPlanListQueryDto,
  UpdateTripPlanDto,
} from "./dto/trips.dto";
import { TripPlansService } from "./trip-plans.service";
import { TRIP_PLAN_SCHEMA, TRIP_SCHEMA } from "./trips.constants";

@ApiTags("trips")
@ApiBearerAuth()
@Controller("trip-plans")
export class TripPlansController {
  constructor(private readonly plans: TripPlansService) {}

  @Get()
  @ApiOperation({ summary: "Upcoming plans (soonest first) or cancelled ones, a page at a time" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: TripPlanListQueryDto,
  ): Promise<Paginated<TripPlan>> {
    return this.plans.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Plan a trip (a retried client id returns the same plan)" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409, 503)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTripPlanDto): Promise<TripPlan> {
    return this.plans.create(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "A planned, draft or cancelled trip" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<TripPlan> {
    return this.plans.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change a plan (merged and re-checked whole)" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409, 503)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateTripPlanDto,
  ): Promise<TripPlan> {
    return this.plans.update(user.id, id, body);
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel a plan (kept under Cancelled)" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  cancel(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<TripPlan> {
    return this.plans.setCancelled(user.id, id, true);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Make a cancelled plan a plan again" })
  @ApiEnvelopeResponse(TRIP_PLAN_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  restore(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TripPlan> {
    return this.plans.setCancelled(user.id, id, false);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a plan done: it becomes a trip with what actually happened" })
  @ApiEnvelopeResponse(TRIP_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409, 503)
  complete(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CompleteTripPlanDto,
  ): Promise<Trip> {
    return this.plans.complete(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a plan (done trips are deleted from history)" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.plans.remove(user.id, id);
  }
}
