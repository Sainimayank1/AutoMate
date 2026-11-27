import { type ApiErrorResponse, ErrorCode, type FieldError } from "@automate/shared";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import type { Request, Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";

interface ErrorShape {
  status: number;
  code: ErrorCode;
  message: string;
  details: unknown[];
}

const INTERNAL_ERROR: ErrorShape = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: ErrorCode.INTERNAL_ERROR,
  message: "Internal server error",
  details: [],
};

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Prisma errors that are client mistakes rather than server faults. Everything else is a 500. */
const PRISMA_ERRORS: Partial<Record<string, ErrorShape>> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.CONFLICT,
    message: "A record with the same unique value already exists",
    details: [],
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    code: ErrorCode.NOT_FOUND,
    message: "Record not found",
    details: [],
  },
};

/**
 * The single place errors become HTTP responses. 4xx messages are safe to show users;
 * 5xx responses are always generic and the real error is only logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const error = toErrorShape(exception);

    if (error.status >= 500) this.logger.error(exception);
    if (response.headersSent) return;

    const body: ApiErrorResponse = {
      success: false,
      message: error.message,
      // genReqId (logger.config.ts) always produces a string id.
      error: {
        code: error.code,
        details: error.details,
        requestId: typeof request.id === "string" ? request.id : "",
      },
    };
    response.status(error.status).json(body);
  }
}

export function toErrorShape(exception: unknown): ErrorShape {
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    const details: FieldError[] =
      zodError instanceof ZodError
        ? zodError.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
        : [];
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.VALIDATION_ERROR,
      message: "Validation failed",
      details,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    // 503 carries a deliberate, safe message (e.g. health); other 5xx never expose theirs.
    if (status >= 500 && status !== 503) return { ...INTERNAL_ERROR, status };
    const body = exception.getResponse();
    return {
      status,
      code: CODE_BY_STATUS[status] ?? ErrorCode.BAD_REQUEST,
      message: messageOf(body) ?? exception.message,
      details: detailsOf(body),
    };
  }

  // Express/body-parser errors (http-errors), e.g. 413 body too large. `expose` marks them client-safe.
  if (isExposedClientError(exception)) {
    return {
      status: exception.status,
      code: CODE_BY_STATUS[exception.status] ?? ErrorCode.BAD_REQUEST,
      message: exception.message,
      details: [],
    };
  }

  if (exception instanceof PrismaClientKnownRequestError) {
    return PRISMA_ERRORS[exception.code] ?? INTERNAL_ERROR;
  }

  return INTERNAL_ERROR;
}

function isExposedClientError(error: unknown): error is Error & { status: number } {
  if (!(error instanceof Error)) return false;
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return expose === true && typeof status === "number" && status >= 400 && status < 500;
}

/** Reads `message` from `new XException("text")` or `new XException({ message })`. */
function messageOf(body: string | object): string | undefined {
  if (typeof body === "string") return body;
  const { message } = body as { message?: unknown };
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return undefined;
}

/** Reads `details` from `new XException({ message, details: [...] })`. */
function detailsOf(body: string | object): unknown[] {
  if (typeof body === "string") return [];
  const { details } = body as { details?: unknown };
  return Array.isArray(details) ? details : [];
}
