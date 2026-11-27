import type { TripCost, TripCostsSummary, TripFuelEntry, TripSpending } from "@automate/shared";
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
  CreateTripCostDto,
  LinkFuelEntryDto,
  TripCategoryListQueryDto,
  TripCostListQueryDto,
  TripCostSummaryQueryDto,
  UpdateTripCostDto,
} from "./dto/trips.dto";
import { TripCostsService } from "./trip-costs.service";
import {
  TRIP_COST_SCHEMA,
  TRIP_COSTS_SUMMARY_SCHEMA,
  TRIP_FUEL_ENTRY_SCHEMA,
  TRIP_SPENDING_SCHEMA,
} from "./trips.constants";

const COSTS = "trips/:tripId/costs";
const FUEL = "trips/:tripId/fuel-entries";

@ApiTags("trips")
@ApiBearerAuth()
@Controller()
export class TripCostsController {
  constructor(private readonly costs: TripCostsService) {}

  @Get("trip-costs")
  @ApiOperation({ summary: "Trip costs across trips by their date, newest first" })
  @ApiEnvelopeResponse(TRIP_COST_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  across(
    @CurrentUser() user: AuthUser,
    @Query() query: TripCostListQueryDto,
  ): Promise<Paginated<TripCost>> {
    return this.costs.across(user.id, query);
  }

  @Get("trip-costs/summary")
  @ApiOperation({ summary: "Actual trip costs in a period by category (linked fuel included)" })
  @ApiEnvelopeResponse(TRIP_COSTS_SUMMARY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: TripCostSummaryQueryDto,
  ): Promise<TripCostsSummary> {
    return this.costs.summary(user.id, query);
  }

  @Get("trip-costs/:id")
  @ApiOperation({ summary: "A trip cost (with its trip)" })
  @ApiEnvelopeResponse(TRIP_COST_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  one(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<TripCost> {
    return this.costs.get(user.id, id);
  }

  @Get(COSTS)
  @ApiOperation({ summary: "A trip's costs, newest first" })
  @ApiEnvelopeResponse(TRIP_COST_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Query() query: TripCategoryListQueryDto,
  ): Promise<Paginated<TripCost>> {
    return this.costs.list(user.id, tripId, query);
  }

  @Post(COSTS)
  @ApiOperation({ summary: "Add a cost (toll, parking and other also become expenses)" })
  @ApiEnvelopeResponse(TRIP_COST_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body() body: CreateTripCostDto,
  ): Promise<TripCost> {
    return this.costs.create(user.id, tripId, body);
  }

  @Patch(`${COSTS}/:id`)
  @ApiOperation({ summary: "Change a cost (its expense follows)" })
  @ApiEnvelopeResponse(TRIP_COST_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateTripCostDto,
  ): Promise<TripCost> {
    return this.costs.update(user.id, tripId, id, body);
  }

  @Delete(`${COSTS}/:id`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a cost and its expense" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.costs.remove(user.id, tripId, id);
  }

  @Get("trips/:tripId/spending")
  @ApiOperation({ summary: "A trip's actual money and, apart, its fuel estimate" })
  @ApiEnvelopeResponse(TRIP_SPENDING_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  spending(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
  ): Promise<TripSpending> {
    return this.costs.spending(user.id, tripId);
  }

  @Get(FUEL)
  @ApiOperation({ summary: "The fill-ups linked to a trip (its actual fuel)" })
  @ApiEnvelopeResponse(TRIP_FUEL_ENTRY_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  fuel(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Query() query: TripCategoryListQueryDto,
  ): Promise<Paginated<TripFuelEntry>> {
    return this.costs.fuelEntries(user.id, tripId, query);
  }

  @Get("trips/:tripId/fuel-candidates")
  @ApiOperation({ summary: "The vehicle's fill-ups around the trip that could be linked" })
  @ApiEnvelopeResponse(TRIP_FUEL_ENTRY_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  candidates(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Query() query: TripCategoryListQueryDto,
  ): Promise<Paginated<TripFuelEntry>> {
    return this.costs.fuelCandidates(user.id, tripId, query);
  }

  @Post(FUEL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Link a fill-up of the same vehicle to the trip" })
  @ApiErrorResponses(400, 401, 404, 409)
  link(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body() body: LinkFuelEntryDto,
  ): Promise<void> {
    return this.costs.linkFuel(user.id, tripId, body.fuelEntryId);
  }

  @Delete(`${FUEL}/:fuelEntryId`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unlink a fill-up (it stays in Fuel)" })
  @ApiErrorResponses(400, 401, 404, 409)
  unlink(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("fuelEntryId", ParseUUIDPipe) fuelEntryId: string,
  ): Promise<void> {
    return this.costs.unlinkFuel(user.id, tripId, fuelEntryId);
  }
}
