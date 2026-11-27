/**
 * API response contract shared by apps/api (producer) and apps/web (consumer).
 * See docs/architecture/api-conventions.md.
 */

/** Machine-readable error codes. Clients branch on `code`, never on `message`. */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** One invalid input field. `field` is the dot-joined path, e.g. "odometer" or "items.0.amount". */
export interface FieldError {
  field: string;
  message: string;
}

export interface ApiSuccessResponse<TData, TMeta = Record<string, unknown>> {
  success: true;
  message: string;
  data: TData;
  meta: TMeta | null;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: ErrorCode;
    /** FieldError[] for VALIDATION_ERROR; empty otherwise unless documented per endpoint. */
    details: unknown[];
    /** Correlation id; also sent as the `x-request-id` response header. */
    requestId: string;
  };
}

export type ApiResponse<TData, TMeta = Record<string, unknown>> =
  ApiSuccessResponse<TData, TMeta> | ApiErrorResponse;
