import type { ApiErrorResponse, ErrorCode, FieldError } from "@automate/shared";
import { isAxiosError } from "axios";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";
const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
const TIMEOUT_MESSAGE = "The request timed out. Please try again.";

/** The only error type UI code should see. `message` is always safe to show to users. */
export class ApiError extends Error {
  /** HTTP status, or null when no response arrived (offline, timeout, CORS). */
  readonly status: number | null;
  /** Machine-readable code from the API; branch on this, never on `message`. */
  readonly code: ErrorCode | null;
  /** Field path → message, from `error.details` when the API names fields. */
  readonly fieldErrors: Record<string, string>;
  /** Server correlation id, for support and logs. */
  readonly requestId: string | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: ErrorCode | null;
      fieldErrors?: Record<string, string>;
      requestId?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
    this.requestId = options.requestId ?? null;
  }
}

function isFieldError(value: unknown): value is FieldError {
  const item = value as Partial<FieldError> | null;
  return typeof item?.field === "string" && typeof item.message === "string";
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!isAxiosError(error)) return new ApiError(GENERIC_MESSAGE, { cause: error });

  if (!error.response) {
    const message = error.code === "ECONNABORTED" ? TIMEOUT_MESSAGE : OFFLINE_MESSAGE;
    return new ApiError(message, { cause: error });
  }

  const { status, data, headers } = error.response;
  const body = (typeof data === "object" && data !== null ? data : {}) as Partial<ApiErrorResponse>;
  const code = body.error?.code ?? null;
  const requestId =
    body.error?.requestId ?? (headers["x-request-id"] as string | undefined) ?? null;

  // VALIDATION_ERROR always carries FieldError[]; other codes may too (409 "email already registered").
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(body.error?.details)) {
    for (const item of body.error.details) {
      if (isFieldError(item)) fieldErrors[item.field] ??= item.message;
    }
  }

  // The API already sends a generic 5xx message; don't rely on it.
  const message =
    status < 500 && typeof body.message === "string" && body.message.trim()
      ? body.message
      : GENERIC_MESSAGE;

  return new ApiError(message, { status, code, fieldErrors, requestId, cause: error });
}

/** Retry only failures that might succeed on a second try: no response, rate limits, 5xx. */
export function isRetryableError(error: unknown): boolean {
  const { status } = normalizeApiError(error);
  return status === null || status === 408 || status === 429 || status >= 500;
}
