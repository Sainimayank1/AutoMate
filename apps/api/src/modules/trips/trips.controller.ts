import type {
  RouteResult,
  Trip,
  TripAnalytics,
  TripCategory,
  TripImportPreview,
  TripImportResult,
  TripOverview,
  TripSummary,
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
import { Throttle } from "@nestjs/throttler";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import {
  CreateTripDto,
  RouteCalculateDto,
  TripAnalyticsQueryDto,
  TripBulkDto,
  TripCategoryDto,
  TripCategoryListQueryDto,
  TripFiltersDto,
  TripImportDto,
  TripListQueryDto,
  TripOverviewQueryDto,
  UpdateTripDto,
} from "./dto/trips.dto";
import { TripAnalyticsService } from "./trip-analytics.service";
import { TripImportService } from "./trip-import.service";
import {
  ROUTE_RESULT_SCHEMA,
  TRIP_ANALYTICS_SCHEMA,
  TRIP_BULK_SCHEMA,
  TRIP_CATEGORY_SCHEMA,
  TRIP_IMPORT_PREVIEW_SCHEMA,
  TRIP_IMPORT_RESULT_SCHEMA,
  TRIP_OVERVIEW_SCHEMA,
  TRIP_SCHEMA,
  TRIP_SUMMARY_SCHEMA,
} from "./trips.constants";
import { TripsService } from "./trips.service";

@ApiTags("trips")
@ApiBearerAuth()
@Controller()
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly analyticsService: TripAnalyticsService,
    private readonly importer: TripImportService,
  ) {}

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

  @Get("trips/analytics")
  @ApiOperation({ summary: "Trip analytics and insights for a period, against the one before" })
  @ApiEnvelopeResponse(TRIP_ANALYTICS_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  analytics(
    @CurrentUser() user: AuthUser,
    @Query() query: TripAnalyticsQueryDto,
  ): Promise<TripAnalytics> {
    return this.analyticsService.analytics(user.id, query);
  }

  @Post("trips/import/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check a CSV and its column mapping before importing (nothing saved)" })
  @ApiEnvelopeResponse(TRIP_IMPORT_PREVIEW_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  previewImport(
    @CurrentUser() user: AuthUser,
    @Body() body: TripImportDto,
  ): Promise<TripImportPreview> {
    return this.importer.preview(user.id, body);
  }

  @Post("trips/import")
  @ApiOperation({ summary: "Import a CSV's ready rows (and duplicates when asked) in one go" })
  @ApiEnvelopeResponse(TRIP_IMPORT_RESULT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  import(@CurrentUser() user: AuthUser, @Body() body: TripImportDto): Promise<TripImportResult> {
    return this.importer.commit(user.id, body);
  }

  @Get("trips/summary")
  @ApiOperation({ summary: "How many trips match the filters and their distance (every page)" })
  @ApiEnvelopeResponse(TRIP_SUMMARY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  summary(@CurrentUser() user: AuthUser, @Query() query: TripFiltersDto): Promise<TripSummary> {
    return this.trips.summary(user.id, query);
  }

  @Post("trips/bulk")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete trips, or move them to another type (all or none)" })
  @ApiEnvelopeResponse(TRIP_BULK_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  bulk(@CurrentUser() user: AuthUser, @Body() body: TripBulkDto): Promise<{ count: number }> {
    return this.trips.bulk(user.id, body);
  }

  @Post("trips/routes/calculate")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Driving routes through places, from the configured provider" })
  @ApiEnvelopeResponse(ROUTE_RESULT_SCHEMA)
  @ApiErrorResponses(400, 401, 503)
  calculateRoute(@Body() body: RouteCalculateDto): Promise<RouteResult> {
    return this.trips.calculateRoute(body.points);
  }

  @Get("trips")
  @ApiOperation({ summary: "Trip history: filtered and sorted on the server, a page at a time" })
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
