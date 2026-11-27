import type { ApiSuccessResponse } from "@automate/shared";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { map, type Observable } from "rxjs";

import { DEFAULT_SUCCESS_MESSAGE } from "../constants/http.constants";

/**
 * Wraps every JSON success body in the standard envelope.
 * File streams and 204 No Content responses pass through untouched.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile || response.statusCode === 204) {
          return data;
        }
        const body: ApiSuccessResponse<unknown> = {
          success: true,
          message: DEFAULT_SUCCESS_MESSAGE,
          data: data ?? null,
          meta: null,
        };
        return body;
      }),
    );
  }
}
