import type { UserProfile } from "@automate/shared";
import { Controller, Get, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import type { AuthUser } from "@/modules/auth/auth.types";
import { CurrentUser } from "@/modules/auth/decorators/current-user.decorator";

import { USER_PROFILE_SCHEMA } from "./users.constants";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "The signed-in user's profile" })
  @ApiEnvelopeResponse(USER_PROFILE_SCHEMA)
  @ApiErrorResponses(401)
  async me(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    const record = await this.users.findById(user.id);
    // A valid token for a deleted account: treat it like an expired session.
    if (!record) throw new UnauthorizedException("Your session has expired. Please sign in again.");
    return this.users.profile(record);
  }
}
