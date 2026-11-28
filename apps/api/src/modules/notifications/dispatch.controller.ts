import { timingSafeEqual } from "node:crypto";

import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";

import type { Env } from "@/config/env.validation";
import { Public } from "@/modules/auth/decorators/public.decorator";

import { PushService } from "./push.service";

/**
 * For the scheduled job only (`.github/workflows/notify.yml`): `Authorization: Bearer
 * <DISPATCH_SECRET>`. Not found while no secret is configured.
 */
@ApiExcludeController()
@Controller("internal/notifications")
export class DispatchController {
  constructor(
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("dispatch")
  @Public()
  @HttpCode(HttpStatus.OK)
  dispatch(@Headers("authorization") authorization: string | undefined) {
    const secret = this.config.get("DISPATCH_SECRET", { infer: true });
    if (!secret) throw new NotFoundException();
    const given = Buffer.from(authorization?.replace(/^Bearer /, "") ?? "");
    const expected = Buffer.from(secret);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
    return this.push.dispatch();
  }
}
