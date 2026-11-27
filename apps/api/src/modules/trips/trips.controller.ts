import type { Trip, TripCategory, TripOverview } from "@automate/shared";
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
  CreateTripDto,
  TripCategoryDto,
  TripCategoryListQueryDto,
  TripListQueryDto,
  TripOverviewQueryDto,
  UpdateTripDto,
} from "./dto/trips.dto";
import { TRIP_CATEGORY_SCHEMA, TRIP_OVERVIEW_SCHEMA, TRIP_SCHEMA } from "./trips.constants";
import { TripsService } from "./trips.service";

@ApiTags("trips")
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get("trips/overview")
  @ApiOperation({ summary: "Distance, trips and types in a period, for a vehicle or all" })
  @ApiEnvelopeResponse(TRIP_OVERVIEW_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  overview(
    @CurrentUser() user: AuthUser,
    @Query() query: TripOverviewQueryDto,
  ): Promise<TripOverview> {
    return this.trips.overview(user.id, query);
  }

  @Get("trips")
  @ApiOperation({ summary: "Trips, newest first, a page at a time" })
  @ApiEnvelopeResponse(TRIP_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(@CurrentUser() user: AuthUser, @Query() query: TripListQueryDto): Promise<Paginated<Trip>> {
    return this.trips.list(user.id, query);
  }

  @Post("trips")
  @ApiOperation({ summary: "Log a trip (a retried client id returns the same trip)" })
  @ApiEnvelopeResponse(TRIP_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateTripDto): Promise<Trip> {
    return this.trips.create(user.id, body);
  }

  @Get("trips/:id")
  @ApiOperation({ summary: "A trip" })
  @ApiEnvelopeResponse(TRIP_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Trip> {
    return this.trips.get(user.id, id);
  }

  @Patch("trips/:id")
  @ApiOperation({ summary: "Change a trip (merged and re-checked whole)" })
  @ApiEnvelopeResponse(TRIP_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateTripDto,
  ): Promise<Trip> {
    return this.trips.update(user.id, id, body);
  }

  @Delete("trips/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a trip" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.trips.remove(user.id, id);
  }

  @Get("trip-categories")
  @ApiOperation({ summary: "The system trip types and the user's own" })
  @ApiEnvelopeResponse(TRIP_CATEGORY_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  categories(
    @CurrentUser() user: AuthUser,
    @Query() query: TripCategoryListQueryDto,
  ): Promise<Paginated<TripCategory>> {
    return this.trips.categories(user.id, query);
  }

  @Post("trip-categories")
  @ApiOperation({ summary: "Add a trip type of your own" })
  @ApiEnvelopeResponse(TRIP_CATEGORY_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 409)
  createCategory(
    @CurrentUser() user: AuthUser,
    @Body() body: TripCategoryDto,
  ): Promise<TripCategory> {
    return this.trips.createCategory(user.id, body);
  }

  @Patch("trip-categories/:id")
  @ApiOperation({ summary: "Rename one of your trip types" })
  @ApiEnvelopeResponse(TRIP_CATEGORY_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  renameCategory(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: TripCategoryDto,
  ): Promise<TripCategory> {
    return this.trips.renameCategory(user.id, id, body);
  }

  @Post("trip-categories/:id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Hide one of your trip types from the picker (trips keep it)" })
  @ApiEnvelopeResponse(TRIP_CATEGORY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  archiveCategory(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TripCategory> {
    return this.trips.setCategoryArchived(user.id, id, true);
  }

  @Post("trip-categories/:id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bring an archived trip type back" })
  @ApiEnvelopeResponse(TRIP_CATEGORY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  restoreCategory(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TripCategory> {
    return this.trips.setCategoryArchived(user.id, id, false);
  }
}
