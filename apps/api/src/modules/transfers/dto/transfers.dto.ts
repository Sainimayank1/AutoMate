import { createTransferSchema, transferListQuerySchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTransferDto extends createZodDto(createTransferSchema) {}
export class TransferListQueryDto extends createZodDto(transferListQuerySchema) {}
