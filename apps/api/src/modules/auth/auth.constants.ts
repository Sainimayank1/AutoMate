export const JWT_ALGORITHM = "HS256";
export const JWT_ISSUER = "automate-api";
export const JWT_AUDIENCE = "automate-web";

/** Access tokens are short-lived; the refresh flow (auth phase) renews them. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
