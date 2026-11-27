import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

import type { Env } from "@/config/env.validation";

/**
 * CSRF defence for the cookie-based auth routes. Browsers attach `Origin` to cross-site POSTs,
 * so a request from a page outside FRONTEND_URL is refused before the cookie is read or set.
 * Requests without `Origin` (curl, server-to-server) can't carry a victim's cookie and pass.
 */
@Injectable()
export class TrustedOriginGuard implements CanActivate {
  private readonly origins: string[];

  constructor(config: ConfigService<Env, true>) {
    this.origins = config.get("FRONTEND_URL", { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const { origin } = context.switchToHttp().getRequest<Request>().headers;
    if (!origin || this.origins.includes("*") || this.origins.includes(origin)) return true;
    throw new ForbiddenException("This request isn't allowed from this site.");
  }
}
