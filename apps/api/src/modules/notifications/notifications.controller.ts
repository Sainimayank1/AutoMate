import type { NotificationItem, NotificationSummary } from "@automate/shared";
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
  NotificationListQueryDto,
  ReadAllNotificationsDto,
  SnoozeNotificationDto,
  UpdateNotificationDto,
} from "./dto/notifications.dto";
import { NOTIFICATION_SCHEMA, NOTIFICATION_SUMMARY_SCHEMA } from "./notifications.constants";
import { NotificationsService } from "./notifications.service";

/** The in-app inbox: brought up to date from the records whenever it's read. */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "The inbox, newest first (or snoozed ones, soonest back first)" })
  @ApiEnvelopeResponse(NOTIFICATION_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationListQueryDto,
  ): Promise<Paginated<NotificationItem>> {
    return this.notifications.list(user.id, query);
  }

  @Get("summary")
  @ApiOperation({ summary: "The bell: unread count and the latest six, unread first" })
  @ApiEnvelopeResponse(NOTIFICATION_SUMMARY_SCHEMA)
  @ApiErrorResponses(401)
  summary(@CurrentUser() user: AuthUser): Promise<NotificationSummary> {
    return this.notifications.summary(user.id);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Bring the inbox up to date now, then return the bell's summary" })
  @ApiEnvelopeResponse(NOTIFICATION_SUMMARY_SCHEMA)
  @ApiErrorResponses(401)
  refresh(@CurrentUser() user: AuthUser): Promise<NotificationSummary> {
    return this.notifications.summary(user.id, { force: true });
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark every unread notification (of one category) as read" })
  @ApiEnvelopeResponse({ type: "object", properties: { updated: { type: "integer" } } })
  @ApiErrorResponses(400, 401)
  readAll(@CurrentUser() user: AuthUser, @Body() body: ReadAllNotificationsDto) {
    return this.notifications.readAll(user.id, body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Mark as read or unread" })
  @ApiEnvelopeResponse(NOTIFICATION_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateNotificationDto,
  ): Promise<NotificationItem> {
    return this.notifications.setRead(user.id, id, body.read);
  }

  @Post(":id/snooze")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Hide until a time, then back as unread" })
  @ApiEnvelopeResponse(NOTIFICATION_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  snooze(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SnoozeNotificationDto,
  ): Promise<NotificationItem> {
    return this.notifications.snooze(user.id, id, body.until);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Dismiss: gone from the inbox while it still applies" })
  @ApiErrorResponses(400, 401, 404)
  dismiss(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.dismiss(user.id, id);
  }
}
