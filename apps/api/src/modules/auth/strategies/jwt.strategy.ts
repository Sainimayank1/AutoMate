import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { Env } from "@/config/env.validation";

import { JWT_ALGORITHM, JWT_AUDIENCE, JWT_ISSUER } from "../auth.constants";
import type { AccessTokenPayload, AuthUser } from "../auth.types";

/** Verifies `Authorization: Bearer <access token>` (signature, expiry, issuer, audience). */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get("JWT_ACCESS_SECRET", { infer: true }),
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  validate(payload: Partial<AccessTokenPayload>): AuthUser {
    if (typeof payload.sub !== "string" || payload.sub === "") throw new UnauthorizedException();
    return { id: payload.sub };
  }
}
