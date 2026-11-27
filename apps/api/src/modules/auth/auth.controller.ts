import type { AuthSession } from "@automate/shared";
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiOperation, type ApiResponseSchemaHost, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from "@/common/decorators/api-response.decorators";
import { USER_PROFILE_SCHEMA } from "@/modules/users/users.constants";

import { CREDENTIALS_RATE_LIMIT, REFRESH_RATE_LIMIT } from "./auth.constants";
import { AuthService, type ClientInfo } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
import { TrustedOriginGuard } from "./guards/trusted-origin.guard";
import { RefreshCookieService } from "./refresh-cookie.service";

const AUTH_SESSION_SCHEMA: ApiResponseSchemaHost["schema"] = {
  type: "object",
  required: ["user", "accessToken", "expiresIn"],
  properties: {
    user: USER_PROFILE_SCHEMA,
    accessToken: { type: "string", description: "JWT. Send as `Authorization: Bearer <token>`." },
    expiresIn: { type: "integer", example: 900, description: "Access-token lifetime in seconds" },
  },
};

const clientOf = (req: Request): ClientInfo => ({ userAgent: req.headers["user-agent"] });

/**
 * Email + password authentication. Every route sets or clears the httpOnly refresh cookie
 * (`automate_rt`, path `/api/v1/auth`), which is why they all run the trusted-origin check.
 */
@ApiTags("auth")
@Public()
@UseGuards(TrustedOriginGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: RefreshCookieService,
  ) {}

  @Post("register")
  @Throttle(CREDENTIALS_RATE_LIMIT)
  @ApiOperation({ summary: "Create an account and sign in" })
  @ApiEnvelopeResponse(AUTH_SESSION_SCHEMA, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 403, 409)
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.cookie.send(res, await this.auth.register(body, clientOf(req)));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIALS_RATE_LIMIT)
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiEnvelopeResponse(AUTH_SESSION_SCHEMA)
  @ApiErrorResponses(400, 401, 403)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.cookie.send(res, await this.auth.login(body, clientOf(req)));
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle(REFRESH_RATE_LIMIT)
  @ApiOperation({
    summary: "Get a new access token from the refresh cookie",
    description: "Rotates the refresh cookie. The web calls it on start-up and after a 401.",
  })
  @ApiEnvelopeResponse(AUTH_SESSION_SCHEMA)
  @ApiErrorResponses(401, 403)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    try {
      return this.cookie.send(res, await this.auth.refresh(this.cookie.read(req)));
    } catch (error) {
      this.cookie.clear(res); // don't leave a dead token in the browser
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Sign out this device" })
  @ApiErrorResponses(403)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookie.read(req));
    this.cookie.clear(res);
  }
}
