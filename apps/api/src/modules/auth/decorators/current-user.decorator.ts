import { createParamDecorator, type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import type { AuthUser } from "../auth.types";

/** Injects the authenticated user. Scope every query by `user.id`; never trust ids from the body. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const { user } = ctx.switchToHttp().getRequest<Request>();
    // Only reachable on a @Public() route, which is a programming error.
    if (!user) throw new UnauthorizedException();
    return user as AuthUser;
  },
);
