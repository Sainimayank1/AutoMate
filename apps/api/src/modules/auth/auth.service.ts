import { createHash, randomBytes } from "node:crypto";

import type { AuthSession, LoginValues, RegisterValues } from "@automate/shared";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "@/database/prisma.service";
import type { User } from "@/generated/prisma/client";
import { toUserProfile, UsersService } from "@/modules/users/users.service";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  BROWSER_SESSION_TTL_MS,
  INVALID_CREDENTIALS_MESSAGE,
  PERSISTENT_SESSION_TTL_MS,
  SESSION_EXPIRED_MESSAGE,
} from "./auth.constants";
import type { AccessTokenPayload } from "./auth.types";
import { PasswordService } from "./password.service";

export interface ClientInfo {
  userAgent?: string;
}

/** What a successful sign-in produces. The controller puts `refreshToken` in the cookie, never the body. */
export interface IssuedSession {
  session: AuthSession;
  refreshToken: string;
  persistent: boolean;
}

/** Refresh tokens are 256-bit random values; only their SHA-256 hash is stored. */
const newRefreshToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");
const expiryFor = (persistent: boolean) =>
  new Date(Date.now() + (persistent ? PERSISTENT_SESSION_TTL_MS : BROWSER_SESSION_TTL_MS));

@Injectable()
export class AuthService {
  /** Verified against when the email is unknown, so a miss takes as long as a wrong password. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterValues, client: ClientInfo): Promise<IssuedSession> {
    // shortcut: registration reveals that an email is taken; send a verification email instead once email ships.
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictException({
        message: "An account with this email already exists. Sign in instead.",
        details: [{ field: "email", message: "An account with this email already exists" }],
      });
    }
    // A concurrent duplicate still hits the unique index (P2002 → 409).
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
    });
    return this.startSession(user, true, client);
  }

  async login(input: LoginValues, client: ClientInfo): Promise<IssuedSession> {
    const user = await this.users.findByEmail(input.email);
    const hash =
      user?.passwordHash ?? (await (this.dummyHash ??= this.passwords.hash(newRefreshToken())));
    const valid = await this.passwords.verify(hash, input.password);
    // Same message for unknown email and wrong password, so accounts can't be discovered here.
    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    return this.startSession(user, input.rememberMe, client);
  }

  /** Rotates the refresh token: the presented one stops working as soon as this returns. */
  async refresh(token: string | undefined): Promise<IssuedSession> {
    if (!token) throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    const tokenHash = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date()) {
      if (session) await this.prisma.session.deleteMany({ where: { id: session.id } });
      throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);
    }

    const refreshToken = newRefreshToken();
    // Matching the old hash makes rotation atomic: of two concurrent refreshes with one token, one wins.
    const { count } = await this.prisma.session.updateMany({
      where: { id: session.id, tokenHash },
      data: {
        tokenHash: hashToken(refreshToken),
        expiresAt: expiryFor(session.persistent),
        lastUsedAt: new Date(),
      },
    });
    if (count === 0) throw new UnauthorizedException(SESSION_EXPIRED_MESSAGE);

    return {
      session: this.authSession(session.user),
      refreshToken,
      persistent: session.persistent,
    };
  }

  /** Ends this device's session. Idempotent: an unknown or missing token is not an error. */
  async logout(token: string | undefined): Promise<void> {
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  private async startSession(
    user: User,
    persistent: boolean,
    client: ClientInfo,
  ): Promise<IssuedSession> {
    const refreshToken = newRefreshToken();
    await this.prisma.$transaction([
      // Housekeeping: drop this user's expired sessions so the table can't grow without bound.
      this.prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          persistent,
          expiresAt: expiryFor(persistent),
          userAgent: client.userAgent?.slice(0, 255),
        },
      }),
    ]);
    return { session: this.authSession(user), refreshToken, persistent };
  }

  private authSession(user: User): AuthSession {
    const payload: AccessTokenPayload = { sub: user.id };
    return {
      user: toUserProfile(user),
      accessToken: this.jwt.sign(payload),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
