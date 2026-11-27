import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { Env } from "@/config/env.validation";
import { PrismaService } from "@/database/prisma.service";

import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  SESSION_EXPIRED_MESSAGE,
} from "../auth.constants";
import type { AccessTokenPayload, AuthUser } from "../auth.types";

/**
 * Verifies `Authorization: Bearer <access token>`: signature, expiry, issuer, audience, and then
 * that its session still exists in the database. Logout or deleting a user's sessions therefore
 * revokes their access tokens immediately, not after the 15-minute expiry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  async validate(payload: Partial<AccessTokenPayload>): Promise<AuthUser> {
    const { sub, sid } = payload;
    if (typeof sub !== "string" || !sub || typeof sid !== "string" || !sid) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }
    // One primary-key lookup per authenticated request.
    const session = await this.prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true, expiresAt: true },
    });
    if (!session || session.userId !== sub || session.expiresAt <= new Date()) {
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }
    return { id: sub, sessionId: sid };
  }
}
