import {
  attachmentListQuerySchema,
  createAttachmentUploadSchema,
  fileLinkQuerySchema,
} from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class AttachmentListQueryDto extends createZodDto(attachmentListQuerySchema) {}
export class CreateAttachmentUploadDto extends createZodDto(createAttachmentUploadSchema) {}
export class FileLinkQueryDto extends createZodDto(fileLinkQuerySchema) {}
