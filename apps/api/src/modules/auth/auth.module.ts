import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import type { Env } from "@/config/env.validation";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "./auth.constants";
import { PasswordService } from "./password.service";
import { JwtStrategy } from "./strategies/jwt.strategy";

/**
 * Auth infrastructure only: token verification, the global guard (registered in AppModule)
 * and password hashing. Login, registration and refresh flows belong to the auth phase.
 */
@Module({
  imports: [
    // Exported so the auth phase can sign access tokens with the same settings JwtStrategy verifies.
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
  providers: [JwtStrategy, PasswordService],
  exports: [JwtModule, PasswordService],
})
export class AuthModule {}
