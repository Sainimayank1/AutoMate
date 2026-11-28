import type { Reminder } from "@automate/shared";
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
  CreateReminderDto,
  ReminderListQueryDto,
  UpdateReminderDto,
} from "./dto/notifications.dto";
import { REMINDER_SCHEMA } from "./notifications.constants";
import { NotificationsService } from "./notifications.service";
import { RemindersService } from "./reminders.service";

/** The user's own reminders; every change brings the inbox up to date on its next read. */
@ApiTags("notifications")
@ApiBearerAuth()
@Controller("reminders")
export class RemindersController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Open reminders soonest first, or done ones latest first" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA, { paginated: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ReminderListQueryDto,
  ): Promise<Paginated<Reminder>> {
    return this.reminders.list(user.id, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One reminder" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string): Promise<Reminder> {
    return this.reminders.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: "Set a reminder: a date, an optional vehicle, how many days before" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA, { status: 201 })
  @ApiErrorResponses(400, 401, 404)
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateReminderDto): Promise<Reminder> {
    return this.changed(user.id, await this.reminders.create(user.id, body));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change a reminder" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  async update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateReminderDto,
  ): Promise<Reminder> {
    return this.changed(user.id, await this.reminders.update(user.id, id, body));
  }

  @Post(":id/done")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark done (its notification goes)" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  async done(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.changed(user.id, await this.reminders.setDone(user.id, id, true));
  }

  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark not done again" })
  @ApiEnvelopeResponse(REMINDER_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  async reopen(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.changed(user.id, await this.reminders.setDone(user.id, id, false));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a reminder" })
  @ApiErrorResponses(400, 401, 404)
  async remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    await this.reminders.remove(user.id, id);
    this.notifications.forget(user.id);
  }

  private changed(userId: string, reminder: Reminder) {
    this.notifications.forget(userId);
    return reminder;
  }
}
