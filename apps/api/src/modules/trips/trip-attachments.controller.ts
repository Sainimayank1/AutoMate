import type { FileLink, TripAttachment, UploadSlot } from "@automate/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { FILE_LINK_SCHEMA, UPLOAD_SLOT_SCHEMA } from "@/modules/documents/documents.constants";

import { CreateTripUploadDto, TripCategoryListQueryDto } from "./dto/trips.dto";
import { TripAttachmentsService } from "./trip-attachments.service";
import { TRIP_ATTACHMENT_SCHEMA } from "./trips.constants";

@ApiTags("trips")
@ApiBearerAuth()
@Controller("trips/:tripId/attachments")
export class TripAttachmentsController {
  constructor(private readonly attachments: TripAttachmentsService) {}

  @Get()
  @ApiOperation({ summary: "A trip's photos and receipts (up to 20)" })
  @ApiEnvelopeResponse(TRIP_ATTACHMENT_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Query() query: TripCategoryListQueryDto,
  ): Promise<Paginated<TripAttachment>> {
    return this.attachments.list(user.id, tripId, query);
  }

  @Post("uploads")
  @ApiOperation({ summary: "Announce a file: a short-lived URL to PUT it straight to storage" })
  @ApiEnvelopeResponse(UPLOAD_SLOT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404, 409, 503)
  createUpload(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Body() body: CreateTripUploadDto,
  ): Promise<UploadSlot> {
    return this.attachments.createUpload(user.id, tripId, body);
  }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check the uploaded file (it arrived, its size and real type match)" })
  @ApiEnvelopeResponse(TRIP_ATTACHMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 503)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TripAttachment> {
    return this.attachments.confirm(user.id, tripId, id);
  }

  @Get(":id/link")
  @ApiOperation({ summary: "A link to open the file, valid for a few minutes" })
  @ApiEnvelopeResponse(FILE_LINK_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 503)
  link(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FileLink> {
    return this.attachments.link(user.id, tripId, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a photo or receipt" })
  @ApiErrorResponses(400, 401, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param("tripId", ParseUUIDPipe) tripId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.attachments.remove(user.id, tripId, id);
  }
}
