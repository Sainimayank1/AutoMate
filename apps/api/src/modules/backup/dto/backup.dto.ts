import { backupFilesQuerySchema, backupQuerySchema, restoreBackupSchema } from "@automate/shared";
import { createZodDto } from "nestjs-zod";

export class BackupQueryDto extends createZodDto(backupQuerySchema) {}
export class RestoreBackupDto extends createZodDto(restoreBackupSchema) {}
export class BackupFilesQueryDto extends createZodDto(backupFilesQuerySchema) {}
