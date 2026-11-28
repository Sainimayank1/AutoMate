import type { Backup, BackupRestoreReport } from "@automate/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { BACKUP_REPORT_SCHEMA, BACKUP_SCHEMA } from "./backup.constants";
import { BackupService } from "./backup.service";
import { BackupQueryDto, RestoreBackupDto } from "./dto/backup.dto";

/** Backup & Export: a JSON backup of the user's vehicles, and restoring one. */
@ApiTags("backup")
@ApiBearerAuth()
@Controller("backup")
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  @ApiOperation({ summary: "Everything recorded, or one vehicle's archive, as a backup file" })
  @ApiEnvelopeResponse(BACKUP_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  export(@CurrentUser() user: AuthUser, @Query() query: BackupQueryDto): Promise<Backup> {
    return this.backup.export(user.id, query.vehicleId);
  }

  @Post("restore/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check a backup file: what would be restored and what left out" })
  @ApiEnvelopeResponse(BACKUP_REPORT_SCHEMA)
  @ApiErrorResponses(400, 401, 413)
  preview(
    @CurrentUser() user: AuthUser,
    @Body() body: RestoreBackupDto,
  ): Promise<BackupRestoreReport> {
    return this.backup.preview(user.id, body);
  }

  @Post("restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Restore a backup file's vehicles that aren't in the garage yet" })
  @ApiEnvelopeResponse(BACKUP_REPORT_SCHEMA)
  @ApiErrorResponses(400, 401, 413)
  restore(
    @CurrentUser() user: AuthUser,
    @Body() body: RestoreBackupDto,
  ): Promise<BackupRestoreReport> {
    return this.backup.restore(user.id, body);
  }
}
