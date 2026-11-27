export const REQUEST_ID_HEADER = "x-request-id";

export const DEFAULT_SUCCESS_MESSAGE = "Request completed successfully";

/** JSON bodies only. Files never pass through the API body; they go to object storage directly. */
export const JSON_BODY_LIMIT = "100kb";

/** Default per-IP rate limit. Tighten sensitive routes (login, password reset) with @Throttle(). */
export const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 120 };
