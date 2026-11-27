import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import type { Env } from "@/config/env.validation";
import { UsersModule } from "@/modules/users/users.module";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "./auth.constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TrustedOriginGuard } from "./guards/trusted-origin.guard";
import { PasswordService } from "./password.service";
import { RefreshCookieService } from "./refresh-cookie.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

/**
 * Email + password authentication: register, login, refresh (rotating httpOnly cookie) and logout,
 * plus the access-token verification behind the global guard (registered in AppModule).
 */
@Module({
  imports: [
    UsersModule,
    // Signs access tokens with exactly the settings JwtStrategy verifies.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: { algorithms: [JWT_ALGORITHM], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, PasswordService, AuthService, RefreshCookieService, TrustedOriginGuard],
  exports: [JwtModule, PasswordService],
})
export class AuthModule {}
