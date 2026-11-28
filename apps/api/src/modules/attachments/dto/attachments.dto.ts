import { attachmentListQuerySchema, createAttachmentUploadSchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class AttachmentListQueryDto extends createZodDto(attachmentListQuerySchema) {}
export class CreateAttachmentUploadDto extends createZodDto(createAttachmentUploadSchema) {}
