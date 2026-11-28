import type { Attachment, FileLink, UploadSlot } from "@automate/shared";
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
import {
  DOCUMENT_FILE_SCHEMA,
  FILE_LINK_SCHEMA,
  UPLOAD_SLOT_SCHEMA,
} from "@/modules/documents/documents.constants";

import { AttachmentsService } from "./attachments.service";
import { AttachmentListQueryDto, CreateAttachmentUploadDto } from "./dto/attachments.dto";

/** Receipts and files on expenses, service records, tracked parts and inspections. */
@ApiTags("attachments")
@ApiBearerAuth()
@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  @ApiOperation({ summary: "A record's files, oldest first" })
  @ApiEnvelopeResponse(DOCUMENT_FILE_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: AttachmentListQueryDto,
  ): Promise<Paginated<Attachment>> {
    return this.attachments.list(user.id, query);
  }

  @Post("uploads")
  @ApiOperation({ summary: "Announce a file: a short-lived link to PUT it straight to storage" })
  @ApiEnvelopeResponse(UPLOAD_SLOT_SCHEMA, { status: 201 })
  @ApiErrorResponses(400, 401, 404, 503)
  createUpload(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAttachmentUploadDto,
  ): Promise<UploadSlot> {
    return this.attachments.createUpload(user.id, body);
  }

  @Post("uploads/:fileId/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm an upload: it arrived, with the size and type announced" })
  @ApiEnvelopeResponse(DOCUMENT_FILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 503)
  confirm(
    @CurrentUser() user: AuthUser,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<Attachment> {
    return this.attachments.confirm(user.id, fileId);
  }

  @Get(":id/link")
  @ApiOperation({ summary: "A link to view or download the file, valid for five minutes" })
  @ApiEnvelopeResponse(FILE_LINK_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 503)
  link(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<FileLink> {
    return this.attachments.link(user.id, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a file" })
  @ApiErrorResponses(400, 401, 404)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.attachments.remove(user.id, id);
  }
}
