import type {
  DocumentFile,
  DocumentSummary,
  FileLink,
  UploadSlot,
  VehicleDocument,
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

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import {
  DOCUMENT_FILE_SCHEMA,
  DOCUMENT_SCHEMA,
  DOCUMENT_SUMMARY_SCHEMA,
  FILE_LINK_SCHEMA,
  UPLOAD_SLOT_SCHEMA,
} from "./documents.constants";
import { DocumentsService } from "./documents.service";
import {
  CreateDocumentDto,
  CreateUploadDto,
  DocumentListQueryDto,
  DocumentSummaryQueryDto,
  UpdateDocumentDto,
} from "./dto/document.dto";

/** Documents & reminders: papers with their dates, and their files in private storage. */
@ApiTags("documents")
@ApiBearerAuth()
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: "Documents, expired and soonest to expire first" })
  @ApiEnvelopeResponse(DOCUMENT_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: DocumentListQueryDto,
  ): Promise<Paginated<VehicleDocument>> {
    return this.documents.list(user.id, query);
  }

  @Get("summary")
  @ApiOperation({ summary: "How many documents are valid, expiring and expired" })
  @ApiEnvelopeResponse(DOCUMENT_SUMMARY_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: DocumentSummaryQueryDto,
  ): Promise<DocumentSummary> {
    return this.documents.summary(user.id, query);
  }

  @Post("uploads")
  @ApiOperation({ summary: "Announce a file: returns where to PUT it (straight to storage)" })
  @ApiEnvelopeResponse(UPLOAD_SLOT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 503)
  createUpload(@CurrentUser() user: AuthUser, @Body() body: CreateUploadDto): Promise<UploadSlot> {
    return this.documents.createUpload(user.id, body);
  }

  @Post("uploads/:fileId/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm an upload: it arrived, with the size and type announced" })
  @ApiEnvelopeResponse(DOCUMENT_FILE_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  confirmUpload(
    @CurrentUser() user: AuthUser,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<DocumentFile> {
    return this.documents.confirmUpload(user.id, fileId);
  }

  @Post()
  @ApiOperation({ summary: "Add a document, with uploaded files" })
  @ApiEnvelopeResponse(DOCUMENT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 404)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDocumentDto): Promise<VehicleDocument> {
    return this.documents.create(user.id, body);
  }

  @Get(":id")
  @ApiOperation({ summary: "One document" })
  @ApiEnvelopeResponse(DOCUMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VehicleDocument> {
    return this.documents.get(user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a document (fileIds replaces its files)" })
  @ApiEnvelopeResponse(DOCUMENT_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDocumentDto,
  ): Promise<VehicleDocument> {
    return this.documents.update(user.id, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a document and its files" })
  @ApiErrorResponses(400, 401, 404)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.remove(user.id, id);
  }

  @Get(":id/files/:fileId/link")
  @ApiOperation({ summary: "A link to view or download a file, valid for a few minutes" })
  @ApiEnvelopeResponse(FILE_LINK_SCHEMA)
  @ApiErrorResponses(400, 401, 404, 503)
  fileLink(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<FileLink> {
    return this.documents.fileLink(user.id, id, fileId);
  }
}
