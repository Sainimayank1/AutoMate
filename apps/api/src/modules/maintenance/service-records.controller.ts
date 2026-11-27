import type { MaintenanceProvider, ServiceRecord } from "@automate/shared";
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
  CreateServiceRecordDto,
  ProviderListQueryDto,
  ServiceRecordListQueryDto,
  UpdateServiceRecordDto,
} from "./dto/maintenance.dto";
import { PROVIDER_SCHEMA, SERVICE_RECORD_SCHEMA } from "./maintenance.constants";
import { ServiceRecordsService } from "./service-records.service";

const RECORDS = "vehicles/:vehicleId/service-records";

@ApiTags("maintenance")
@ApiBearerAuth()
@Controller()
export class ServiceRecordsController {
  constructor(private readonly records: ServiceRecordsService) {}

  @Get(RECORDS)
  @ApiOperation({
    summary: "A vehicle's service and repair records, newest first, a page at a time",
  })
  @ApiEnvelopeResponse(SERVICE_RECORD_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Query() query: ServiceRecordListQueryDto,
  ): Promise<Paginated<ServiceRecord>> {
    return this.records.list(user.id, vehicleId, query);
  }

  @Get(`${RECORDS}/:id`)
  @ApiOperation({ summary: "One service record with its items and linked expense" })
  @ApiEnvelopeResponse(SERVICE_RECORD_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ServiceRecord> {
    return this.records.get(user.id, vehicleId, id);
  }

  @Post(RECORDS)
  @ApiOperation({
    summary: "Log a service or repair (completes schedules, adds its expense, raises the odometer)",
  })
  @ApiEnvelopeResponse(SERVICE_RECORD_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409)
  create(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Body() body: CreateServiceRecordDto,
  ): Promise<ServiceRecord> {
    return this.records.create(user.id, vehicleId, body);
  }

  @Patch(`${RECORDS}/:id`)
  @ApiOperation({
    summary: "Change a service record (null clears a field; items replace the list)",
  })
  @ApiEnvelopeResponse(SERVICE_RECORD_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateServiceRecordDto,
  ): Promise<ServiceRecord> {
    return this.records.update(user.id, vehicleId, id, body);
  }

  @Delete(`${RECORDS}/:id`)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a service record and its expense" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("vehicleId", ParseUUIDPipe) vehicleId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.records.remove(user.id, vehicleId, id);
  }

  @Get("maintenance-providers")
  @ApiOperation({ summary: "The user's workshops by name, a page at a time" })
  @ApiEnvelopeResponse(PROVIDER_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  providers(
    @CurrentUser() user: AuthUser,
    @Query() query: ProviderListQueryDto,
  ): Promise<Paginated<MaintenanceProvider>> {
    return this.records.providers(user.id, query);
  }
}
