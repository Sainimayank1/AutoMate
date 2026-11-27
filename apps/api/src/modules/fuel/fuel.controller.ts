import type { FuelEntry, FuelSummary } from "@automate/shared";
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
  CreateFuelEntryDto,
  FuelEntryListQueryDto,
  UpdateFuelEntryDto,
} from "./dto/fuel-entry.dto";
import { FUEL_ENTRY_SCHEMA, FUEL_SUMMARY_SCHEMA } from "./fuel.constants";
import { FuelService } from "./fuel.service";

@ApiTags("fuel")
@ApiBearerAuth()
@Controller("vehicles/:vehicleId")
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get("fuel-entries")
  @ApiOperation({
    summary: "A vehicle's fill-ups, newest first, with mileage per full tank, a page at a time",
  })
  @ApiEnvelopeResponse(FUEL_ENTRY_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: FuelEntryListQueryDto,
  ): Promise<Paginated<FuelEntry>> {
    return this.fuel.list(user.id, vehicleId, query);
  }

  @Get("fuel-summary")
  @ApiOperation({ summary: "Mileage, spend and price figures for a vehicle" })
  @ApiEnvelopeResponse(FUEL_SUMMARY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  summary(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
  ): Promise<FuelSummary> {
    return this.fuel.summary(user.id, vehicleId);
  }

  @Get("fuel-entries/:id")
  @ApiOperation({ summary: "One fill-up" })
  @ApiEnvelopeResponse(FUEL_ENTRY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FuelEntry> {
    return this.fuel.get(user.id, vehicleId, id);
  }

  @Post("fuel-entries")
  @ApiOperation({ summary: "Log a fill-up (raises the vehicle's odometer if newer)" })
  @ApiEnvelopeResponse(FUEL_ENTRY_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: CreateFuelEntryDto,
  ): Promise<FuelEntry> {
    return this.fuel.create(user.id, vehicleId, body);
  }

  @Patch("fuel-entries/:id")
  @ApiOperation({ summary: "Update a fill-up (send only the fields that change)" })
  @ApiEnvelopeResponse(FUEL_ENTRY_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateFuelEntryDto,
  ): Promise<FuelEntry> {
    return this.fuel.update(user.id, vehicleId, id, body);
  }

  @Delete("fuel-entries/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a fill-up" })
  @ApiErrorResponses(400, 401, 404)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.fuel.remove(user.id, vehicleId, id);
  }
}
