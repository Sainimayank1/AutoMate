import type { SessionInfo, UploadSlot, UserPreferences, UserProfile } from "@automate/shared";
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
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { Paginated } from "@/common/pagination/paginated";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";
import { RefreshCookieService } from "@/modules/auth/refresh-cookie.service";
import { UPLOAD_SLOT_SCHEMA } from "@/modules/documents/documents.constants";
import { USER_PROFILE_SCHEMA } from "@/modules/users/users.constants";

import {
  ChangePasswordDto,
  CreateAvatarUploadDto,
  DeleteAccountDto,
  SessionListQueryDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from "./dto/settings.dto";
import { PREFERENCES_SCHEMA, SESSION_SCHEMA } from "./settings.constants";
import { SettingsService } from "./settings.service";

/** Settings: the profile and photo, preferences, password, signed-in devices, the account. */
@ApiTags("settings")
@ApiBearerAuth()
@Controller()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly cookie: RefreshCookieService,
  ) {}

  @Patch("users/me")
  @ApiOperation({ summary: "Change your name or email (the email needs your password)" })
  @ApiEnvelopeResponse(USER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401, 409)
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.settings.updateProfile(user.id, body);
  }

  @Post("users/me/avatar/uploads")
  @ApiOperation({ summary: "Announce a profile photo: returns where to PUT it" })
  @ApiEnvelopeResponse(UPLOAD_SLOT_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 503)
  avatarUpload(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAvatarUploadDto,
  ): Promise<UploadSlot> {
    return this.settings.createAvatarUpload(user.id, body);
  }

  @Post("users/me/avatar/uploads/:fileId/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm the uploaded photo: it becomes your profile photo" })
  @ApiEnvelopeResponse(USER_PROFILE_SCHEMA)
  @ApiErrorResponses(400, 401)
  confirmAvatar(
    @CurrentUser() user: AuthUser,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<UserProfile> {
    return this.settings.confirmAvatar(user.id, fileId);
  }

  @Delete("users/me/avatar")
  @ApiOperation({ summary: "Remove your profile photo" })
  @ApiEnvelopeResponse(USER_PROFILE_SCHEMA)
  @ApiErrorResponses(401)
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.settings.removeAvatar(user.id);
  }

  @Get("users/me/preferences")
  @ApiOperation({ summary: "Your preferences and reminder switches" })
  @ApiEnvelopeResponse(PREFERENCES_SCHEMA)
  @ApiErrorResponses(401)
  preferences(@CurrentUser() user: AuthUser): Promise<UserPreferences> {
    return this.settings.preferences(user.id);
  }

  @Patch("users/me/preferences")
  @ApiOperation({ summary: "Change preferences (only what's sent)" })
  @ApiEnvelopeResponse(PREFERENCES_SCHEMA)
  @ApiErrorResponses(400, 401, 404)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdatePreferencesDto,
  ): Promise<UserPreferences> {
    return this.settings.updatePreferences(user.id, body);
  }

  @Post("users/me/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete your account and all its data, for good" })
  @ApiErrorResponses(400, 401)
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.settings.deleteAccount(user.id, body);
    this.cookie.clear(res);
  }

  @Post("auth/password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Change your password (signs your other devices out)" })
  @ApiErrorResponses(400, 401)
  changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto): Promise<void> {
    return this.settings.changePassword(user.id, user.sessionId, body);
  }

  @Get("auth/sessions")
  @ApiOperation({ summary: "Your signed-in devices, most recently used first" })
  @ApiEnvelopeResponse(SESSION_SCHEMA, { paginated: true })
  @ApiErrorResponses(401)
  sessions(
    @CurrentUser() user: AuthUser,
    @Query() query: SessionListQueryDto,
  ): Promise<Paginated<SessionInfo>> {
    return this.settings.sessions(user.id, user.sessionId, query);
  }

  @Delete("auth/sessions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Sign one device out" })
  @ApiErrorResponses(400, 401, 404)
  revokeSession(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.settings.revokeSession(user.id, id);
  }

  @Post("auth/sessions/revoke-others")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign every other device out" })
  @ApiErrorResponses(401)
  async revokeOthers(@CurrentUser() user: AuthUser): Promise<{ signedOut: number }> {
    return { signedOut: await this.settings.revokeOtherSessions(user.id, user.sessionId) };
  }
}
