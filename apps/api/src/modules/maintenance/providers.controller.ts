import { type ProviderProfile, type ServiceRecord } from "@automate/shared";
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
  CreateProviderDto,
  PaginationQueryDto,
  ProviderListQueryDto,
  UpdateProviderDto,
} from "./dto/maintenance.dto";
import { PROVIDER_PROFILE_SCHEMA, SERVICE_RECORD_SCHEMA } from "./maintenance.constants";
import { ProvidersService } from "./providers.service";

const PROVIDERS = "maintenance-providers";

@ApiTags("Maintenance")
@ApiBearerAuth()
@Controller(PROVIDERS)
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: "The user's workshops, preferred first, a page at a time" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ProviderListQueryDto,
  ): Promise<Paginated<ProviderProfile>> {
    return this.providers.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: "Add a workshop" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 409)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateProviderDto): Promise<ProviderProfile> {
    return this.providers.create(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "A workshop with its visits and spending" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ProviderProfile> {
    return this.providers.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change a workshop's profile" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 409)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateProviderDto,
  ): Promise<ProviderProfile> {
    return this.providers.update(user.id, id, body);
  }

  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Hide a workshop from suggestions (its history stays)" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  archive(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ProviderProfile> {
    return this.providers.setArchived(user.id, id, true);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bring an archived workshop back" })
  @ApiEnvelopeResponse(PROVIDER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  restore(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ProviderProfile> {
    return this.providers.setArchived(user.id, id, false);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a workshop nothing mentions" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.providers.remove(user.id, id);
  }

  @Get(":id/service-records")
  @ApiOperation({ summary: "A workshop's visits across the user's vehicles, newest first" })
  @ApiEnvelopeResponse(SERVICE_RECORD_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  visits(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<ServiceRecord>> {
    return this.providers.visits(user.id, id, query);
  }
}
