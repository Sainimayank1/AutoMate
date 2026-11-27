import type { AuthSession } from "@automate/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CookieOptions, Request, Response } from "express";

import type { Env } from "@/config/env.validation";

import { PERSISTENT_SESSION_TTL_MS, REFRESH_COOKIE_NAME } from "./auth.constants";
import type { IssuedSession } from "./auth.service";

/** Reads, sets and clears the refresh-token cookie. JavaScript can never read it (httpOnly). */
@Injectable()
export class RefreshCookieService {
  private readonly options: CookieOptions;

  constructor(config: ConfigService<Env, true>) {
    const sameSite = config.get("REFRESH_COOKIE_SAMESITE", { infer: true });
    this.options = {
      httpOnly: true,
      // Browsers reject SameSite=None without Secure.
      secure: config.get("NODE_ENV", { infer: true }) === "production" || sameSite === "none",
      sameSite,
      // Sent only to the auth routes, never with ordinary API calls.
      path: `/${config.get("API_PREFIX", { infer: true })}/${config.get("API_VERSION", { infer: true })}/auth`,
    };
  }

  read(req: Request): string | undefined {
    const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[
      REFRESH_COOKIE_NAME
    ];
    return typeof value === "string" && value !== "" ? value : undefined;
  }

  /** Sets the cookie and returns the response body. */
  send(res: Response, issued: IssuedSession): AuthSession {
    res.cookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      ...this.options,
      // No maxAge = a browser-session cookie, gone when the browser closes.
      ...(issued.persistent && { maxAge: PERSISTENT_SESSION_TTL_MS }),
    });
    return issued.session;
  }

  clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.options);
  }
}
