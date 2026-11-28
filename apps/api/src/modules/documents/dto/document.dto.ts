import {
  createDocumentSchema,
  createUploadSchema,
  documentListQuerySchema,
  documentSummaryQuerySchema,
  fileLinkQuerySchema,
  updateDocumentSchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateDocumentDto extends createZodDto(createDocumentSchema) {}
export class UpdateDocumentDto extends createZodDto(updateDocumentSchema) {}
export class DocumentListQueryDto extends createZodDto(documentListQuerySchema) {}
export class DocumentSummaryQueryDto extends createZodDto(documentSummaryQuerySchema) {}
export class CreateUploadDto extends createZodDto(createUploadSchema) {}
export class FileLinkQueryDto extends createZodDto(fileLinkQuerySchema) {}
